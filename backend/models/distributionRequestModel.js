import mongoose from "mongoose";

const distributionRequestSchema = new mongoose.Schema({
    // Manufacturing item being distributed
    manufacturingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Manufacturing',
        required: true
    },
    batchId: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    
    // Sender (Manufacturer)
    manufacturerId: {
        type: String,
        required: true
    },
    manufacturerName: {
        type: String,
        default: ''
    },
    
    // Receiver (Distributor)
    distributorId: {
        type: String,
        required: true
    },
    distributorName: {
        type: String,
        default: ''
    },
    
    // Storage requirements
    storageRequirements: {
        temperature: { type: String, default: '' },
        humidity: { type: String, default: '' },
        specialRequirements: { type: String, default: '' }
    },
    
    // Status workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    
    // Approval tracking
    approvedBy: {
        type: String,
        default: null
    },
    approvedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    
    // Timeline
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
distributionRequestSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Index for efficient querying
distributionRequestSchema.index({ distributorId: 1, status: 1 });
distributionRequestSchema.index({ manufacturerId: 1, status: 1 });
distributionRequestSchema.index({ createdAt: -1 });

export default mongoose.model("DistributionRequest", distributionRequestSchema);
