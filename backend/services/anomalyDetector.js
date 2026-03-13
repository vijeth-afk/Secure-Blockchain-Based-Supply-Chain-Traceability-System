import AnomalyAlert from "../models/anomalyAlertModel.js";
import AnomalyData from "../models/anomalyDataModel.js";
import RawMaterial from "../models/rawMaterialModel.js";
import Manufacturing from "../models/manufacturingModel.js";
import DistributorInventory from "../models/distributorInventoryModel.js";
import RetailerInventory from "../models/RetailerInventory.js";

// Statistical helper functions
const calculateMean = (values) => {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const calculateStdDev = (values) => {
    if (values.length < 2) return 0;
    const mean = calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = calculateMean(squaredDiffs);
    return Math.sqrt(variance);
};

const calculateZScore = (value, mean, stdDev) => {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
};

// Isolation Forest implementation (simplified)
class IsolationForest {
    constructor(contamination = 0.1, nTrees = 100) {
        this.contamination = contamination;
        this.nTrees = nTrees;
        this.trees = [];
    }

    fit(data) {
        // Simplified implementation - in production, use ml-isolation-forest library
        // This is a basic anomaly score calculation based on statistical outliers
        this.baseline = {
            means: {},
            stdDevs: {}
        };

        const features = Object.keys(data[0] || {});
        features.forEach(feature => {
            const values = data.map(d => d[feature]).filter(v => typeof v === 'number');
            this.baseline.means[feature] = calculateMean(values);
            this.baseline.stdDevs[feature] = calculateStdDev(values);
        });
    }

    predict(sample) {
        // Calculate anomaly score based on z-scores
        let totalScore = 0;
        let featureCount = 0;

        Object.keys(sample).forEach(feature => {
            if (typeof sample[feature] === 'number' && this.baseline.means[feature] !== undefined) {
                const zScore = Math.abs(calculateZScore(
                    sample[feature],
                    this.baseline.means[feature],
                    this.baseline.stdDevs[feature]
                ));
                // Convert z-score to anomaly score (0-1)
                const featureScore = Math.min(zScore / 5, 1); // z-score > 5 = max anomaly
                totalScore += featureScore;
                featureCount++;
            }
        });

        return featureCount > 0 ? totalScore / featureCount : 0;
    }
}

// Main anomaly detector class
class AnomalyDetector {
    constructor() {
        this.models = {
            raw_material: new IsolationForest(),
            manufacturing: new IsolationForest(),
            distributor: new IsolationForest(),
            retailer: new IsolationForest()
        };
        this.isInitialized = false;
    }

    // Initialize models with historical data
    async initialize() {
        try {
            console.log("🔍 Initializing anomaly detection models...");

            // Load historical data for each entity type
            const historicalData = await AnomalyData.find({ isAnomaly: false })
                .sort({ timestamp: -1 })
                .limit(1000);

            // Group by entity type
            const groupedData = {
                raw_material: [],
                manufacturing: [],
                distributor: [],
                retailer: []
            };

            historicalData.forEach(record => {
                if (record.features && groupedData[record.entityType]) {
                    groupedData[record.entityType].push(record.features);
                }
            });

            // Train models
            Object.keys(this.models).forEach(entityType => {
                if (groupedData[entityType].length > 10) {
                    this.models[entityType].fit(groupedData[entityType]);
                    console.log(`✅ Trained ${entityType} model with ${groupedData[entityType].length} samples`);
                }
            });

            this.isInitialized = true;
            console.log("✅ Anomaly detection initialized");
        } catch (error) {
            console.error("❌ Error initializing anomaly detector:", error);
        }
    }

    // Extract features from entity
    extractFeatures(entity, entityType) {
        const now = new Date();
        const features = {
            dayOfWeek: now.getDay(),
            hourOfDay: now.getHours(),
            isWeekend: now.getDay() === 0 || now.getDay() === 6
        };

        switch (entityType) {
            case 'raw_material':
                features.quantity = entity.quantity || 0;
                features.pricePerUnit = entity.pricePerUnit || 0;
                if (entity.timestamp) {
                    features.timeSinceLastUpdate = (now - new Date(entity.timestamp)) / (1000 * 60 * 60);
                }
                break;

            case 'manufacturing':
                features.quantity = entity.quantity || 0;
                features.pricePerUnit = entity.pricePerUnit || 0;
                if (entity.productionDate) {
                    features.timeSinceLastUpdate = (now - new Date(entity.productionDate)) / (1000 * 60 * 60);
                }
                break;

            case 'distributor':
                features.quantity = entity.quantity || 0;
                if (entity.shippingDetails?.cost) {
                    features.pricePerUnit = entity.shippingDetails.cost / (entity.quantity || 1);
                }
                if (entity.createdAt) {
                    features.timeSinceLastUpdate = (now - new Date(entity.createdAt)) / (1000 * 60 * 60);
                }
                break;

            case 'retailer':
                features.quantity = entity.quantityInStock || 0;
                features.pricePerUnit = entity.retailPrice || 0;
                if (entity.createdAt) {
                    features.timeSinceLastUpdate = (now - new Date(entity.createdAt)) / (1000 * 60 * 60);
                }
                break;
        }

        return features;
    }

    // Detect anomalies in a single entity
    async detectAnomaly(entity, entityType) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const features = this.extractFeatures(entity, entityType);
        const anomalyScore = this.models[entityType].predict(features);

        // Determine severity based on score
        let severity = 'low';
        if (anomalyScore > 0.8) severity = 'critical';
        else if (anomalyScore > 0.6) severity = 'high';
        else if (anomalyScore > 0.4) severity = 'medium';

        const isAnomaly = anomalyScore > 0.5;

        // Save to anomaly data for future training
        const anomalyData = new AnomalyData({
            entityType,
            entityId: entity._id.toString(),
            features,
            metrics: {
                overallAnomalyScore: anomalyScore
            },
            isAnomaly
        });
        await anomalyData.save();

        if (isAnomaly) {
            // Create alert
            const alert = await this.createAlert({
                severity,
                anomalyType: this.determineAnomalyType(features, anomalyScore),
                affectedEntity: entityType,
                entityId: entity._id.toString(),
                description: this.generateDescription(entity, entityType, features, anomalyScore),
                metadata: {
                    features,
                    anomalyScore,
                    entity: this.sanitizeEntity(entity)
                },
                anomalyScore
            });

            return { isAnomaly: true, alert, anomalyScore };
        }

        return { isAnomaly: false, anomalyScore };
    }

    // Determine the type of anomaly
    determineAnomalyType(features, score) {
        // Check which feature contributed most to the anomaly
        if (features.quantity && Math.abs(features.quantity) > 1000) {
            return 'quantity_anomaly';
        }
        if (features.pricePerUnit && features.pricePerUnit > 10000) {
            return 'price_anomaly';
        }
        if (features.timeSinceLastUpdate && features.timeSinceLastUpdate > 720) { // 30 days
            return 'time_anomaly';
        }
        return 'pattern_mismatch';
    }

    // Generate human-readable description
    generateDescription(entity, entityType, features, score) {
        const scorePercent = (score * 100).toFixed(1);
        let desc = `Anomaly detected in ${entityType.replace('_', ' ')} (score: ${scorePercent}%). `;

        if (features.quantity) {
            desc += `Quantity: ${features.quantity}. `;
        }
        if (features.pricePerUnit) {
            desc += `Price per unit: ${features.pricePerUnit}. `;
        }
        if (features.timeSinceLastUpdate) {
            desc += `Time since last update: ${features.timeSinceLastUpdate.toFixed(1)} hours. `;
        }

        return desc;
    }

    // Sanitize entity for storage (remove sensitive data)
    sanitizeEntity(entity) {
        const sanitized = { ...entity.toObject() };
        delete sanitized.signature;
        delete sanitized.signerPublicKey;
        return sanitized;
    }

    // Create anomaly alert
    async createAlert(alertData) {
        const alert = new AnomalyAlert(alertData);
        await alert.save();
        console.log(`🚨 Anomaly alert created: ${alert.alertId} (${alert.severity})`);
        return alert;
    }

    // Batch scan for anomalies
    async scanAll() {
        console.log("🔍 Starting full anomaly scan...");
        const results = {
            raw_material: [],
            manufacturing: [],
            distributor: [],
            retailer: []
        };

        try {
            // Scan raw materials
            const rawMaterials = await RawMaterial.find().limit(100).sort({ timestamp: -1 });
            for (const material of rawMaterials) {
                const result = await this.detectAnomaly(material, 'raw_material');
                if (result.isAnomaly) results.raw_material.push(result);
            }

            // Scan manufacturing
            const manufacturing = await Manufacturing.find().limit(100).sort({ createdAt: -1 });
            for (const item of manufacturing) {
                const result = await this.detectAnomaly(item, 'manufacturing');
                if (result.isAnomaly) results.manufacturing.push(result);
            }

            // Scan distributor inventory
            const distributorItems = await DistributorInventory.find().limit(100).sort({ createdAt: -1 });
            for (const item of distributorItems) {
                const result = await this.detectAnomaly(item, 'distributor');
                if (result.isAnomaly) results.distributor.push(result);
            }

            // Scan retailer inventory
            const retailerItems = await RetailerInventory.find().limit(100).sort({ createdAt: -1 });
            for (const item of retailerItems) {
                const result = await this.detectAnomaly(item, 'retailer');
                if (result.isAnomaly) results.retailer.push(result);
            }

            console.log("✅ Anomaly scan complete:", {
                raw_material: results.raw_material.length,
                manufacturing: results.manufacturing.length,
                distributor: results.distributor.length,
                retailer: results.retailer.length
            });

            return results;
        } catch (error) {
            console.error("❌ Error during anomaly scan:", error);
            throw error;
        }
    }
}

// Export singleton instance
const anomalyDetector = new AnomalyDetector();
export default anomalyDetector;
