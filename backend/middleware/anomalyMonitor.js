import anomalyDetector from "../services/anomalyDetector.js";

// Middleware to monitor data changes and detect anomalies in real-time
export const anomalyMonitor = (entityType) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.send;
        const originalJson = res.json;

        // Override json method to intercept successful responses
        res.json = function (data) {
            // Only monitor successful POST/PUT/PATCH operations
            if (res.statusCode >= 200 && res.statusCode < 300) {
                if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                    // Run anomaly detection asynchronously (don't block response)
                    setImmediate(async () => {
                        try {
                            // Extract entity from response
                            let entity = data;

                            // Handle different response formats
                            if (data.data) entity = data.data;
                            if (Array.isArray(data) && data.length > 0) entity = data[0];

                            // Only process if we have a valid entity with _id
                            if (entity && entity._id) {
                                console.log(`🔍 Monitoring ${entityType} for anomalies:`, entity._id);
                                const result = await anomalyDetector.detectAnomaly(entity, entityType);

                                if (result.isAnomaly) {
                                    console.log(`🚨 Anomaly detected in ${entityType}:`, {
                                        alertId: result.alert.alertId,
                                        severity: result.alert.severity,
                                        score: result.anomalyScore.toFixed(3)
                                    });

                                    // Emit WebSocket event if io is available
                                    if (req.app.get('io')) {
                                        req.app.get('io').emit('anomaly_detected', {
                                            alert: result.alert,
                                            timestamp: new Date()
                                        });
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`❌ Error in anomaly monitoring for ${entityType}:`, error.message);
                        }
                    });
                }
            }

            // Call original json method
            return originalJson.call(this, data);
        };

        next();
    };
};

export default anomalyMonitor;
