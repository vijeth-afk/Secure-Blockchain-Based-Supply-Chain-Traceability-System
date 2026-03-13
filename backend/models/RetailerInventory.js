import mongoose from 'mongoose';

const retailerInventorySchema = new mongoose.Schema({
    retailerId: {
        type: String,
        required: true
    },
    productId: {
        type: String,
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    batchNumber: {
        type: String,
        required: true
    },
    quantitySold: {
        type: Number,
        required: true,
        default: 0
    },
    quantityInStock: {
        type: Number,
        required: true,
        default: 0
    },
    receivedFrom: {
        distributorId: String,
        distributorName: String,
        receiveDate: Date
    },
    retailPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['in-stock', 'sold'],
        default: 'in-stock'
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

// Add cryptographic fields
retailerInventorySchema.add({
    signature: { type: String, default: '' },
    signerPublicKey: { type: String, default: '' }
});

retailerInventorySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('RetailerInventory', retailerInventorySchema);
