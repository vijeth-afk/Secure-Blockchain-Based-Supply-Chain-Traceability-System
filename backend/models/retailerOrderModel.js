import mongoose from "mongoose";

const retailerOrderSchema = new mongoose.Schema({
    retailerId: {
        type: String,
        required: true
    },
    retailerName: {
        type: String,
        default: ''
    },
    distributorId: {
        type: String,
        required: true
    },
    inventoryItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DistributorInventory',
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    batchId: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

retailerOrderSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model("RetailerOrder", retailerOrderSchema);
