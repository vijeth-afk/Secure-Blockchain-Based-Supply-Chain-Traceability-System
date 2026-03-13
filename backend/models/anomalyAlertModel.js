import mongoose from "mongoose";

const anomalyAlertSchema = new mongoose.Schema({
    alertId: {
        type: String,
        required: true,
        unique: true,
        default: () => `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        default: 'medium'
    },
    anomalyType: {
        type: String,
        required: true,
        enum: [
            'quantity_anomaly',
            'price_anomaly',
            'time_anomaly',
            'status_anomaly',
            'duplicate_transaction',
            'unauthorized_change',
            'pattern_mismatch',
            'other'
        ]
    },
    affectedEntity: {
        type: String,
        required: true,
        enum: ['raw_material', 'manufacturing', 'distributor', 'retailer', 'system']
    },
    entityId: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['new', 'acknowledged', 'resolved', 'false_positive'],
        default: 'new'
    },
    acknowledgedBy: {
        type: String,
        default: null
    },
    acknowledgedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolutionNotes: {
        type: String,
        default: ''
    },
    // Anomaly score (0-1, higher = more anomalous)
    anomalyScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    // Related alerts (for pattern detection)
    relatedAlerts: [{
        type: String
    }]
});

// Index for faster queries
anomalyAlertSchema.index({ timestamp: -1 });
anomalyAlertSchema.index({ status: 1 });
anomalyAlertSchema.index({ severity: 1 });
anomalyAlertSchema.index({ affectedEntity: 1, entityId: 1 });

export default mongoose.model("AnomalyAlert", anomalyAlertSchema);
