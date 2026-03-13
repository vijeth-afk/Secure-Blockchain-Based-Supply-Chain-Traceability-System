import mongoose from "mongoose";

const rawMaterialSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true,
        enum: ['kg', 'g', 'l', 'ml', 'pcs']
    },
    pricePerUnit: {
        type: Number,
        required: true,
        min: 0
    },
    addedBy: {
        type: String,
        required: true
    },
    sold: {
        type: Boolean,
        default: false
    },
    manufacturerName: {
        type: String,
        default: ""
    },
    manufacturerAddress: {
        type: String,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
    ,
    // verification workflow
    status: {
        type: String,
        enum: ['pending', 'requested', 'approved', 'rejected'],
        default: 'pending'
    },
    // when a manufacturer requests verification from supplier
    requestedBy: {
        type: String,
        default: ''
    },
    requestedAt: {
        type: Date
    },
    requestedStorage: {
        temperature: { type: String, default: '' },
        humidity: { type: String, default: '' },
        specialRequirements: { type: String, default: '' }
    },
    requestedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    approvedBy: {
        type: String,
        default: ''
    },
    approvedAt: {
        type: Date
    },
    signature: {
        type: String,
        default: ''
    },
    signerPublicKey: {
        type: String,
        default: ''
    }
});

export default mongoose.model("RawMaterial", rawMaterialSchema);
