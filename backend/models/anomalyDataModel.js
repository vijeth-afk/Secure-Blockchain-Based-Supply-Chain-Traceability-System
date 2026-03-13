import mongoose from "mongoose";

// Schema for storing historical data used for anomaly detection baseline
const anomalyDataSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    entityType: {
        type: String,
        required: true,
        enum: ['raw_material', 'manufacturing', 'distributor', 'retailer']
    },
    entityId: {
        type: String,
        required: true
    },
    // Extracted features for ML
    features: {
        quantity: Number,
        pricePerUnit: Number,
        timeSinceLastUpdate: Number, // in hours
        statusTransitionTime: Number, // in hours
        dayOfWeek: Number,
        hourOfDay: Number,
        isWeekend: Boolean
    },
    // Calculated metrics
    metrics: {
        quantityZScore: Number,
        priceZScore: Number,
        timeZScore: Number,
        overallAnomalyScore: Number
    },
    isAnomaly: {
        type: Boolean,
        default: false
    },
    // Reference to alert if this was flagged
    alertId: {
        type: String,
        default: null
    }
});

// Index for efficient querying
anomalyDataSchema.index({ timestamp: -1 });
anomalyDataSchema.index({ entityType: 1, entityId: 1 });
anomalyDataSchema.index({ isAnomaly: 1 });

export default mongoose.model("AnomalyData", anomalyDataSchema);
