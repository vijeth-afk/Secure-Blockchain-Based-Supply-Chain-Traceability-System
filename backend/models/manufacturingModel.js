import mongoose from "mongoose";

const manufacturingSchema = new mongoose.Schema({
    productName: { 
        type: String, 
        required: true 
    },
    batchId: { 
        type: String, 
        required: true,
        unique: true 
    },
    productionDate: { 
        type: Date, 
        required: true,
        default: Date.now 
    },
    pricePerUnit: { 
        type: Number, 
        required: true,
        min: 0 
    },
    quantity: { 
        type: Number, 
        required: true,
        min: 0 
    },
    manufacturer: { 
        type: String, 
        required: true  // Will store ethereum address
    },
    status: {
        type: String,
        enum: ['in-production', 'completed', 'shipped'],
        default: 'in-production'
    },
    distributorId: {
        type: String,
        default: null
    },
    distributorName: {
        type: String,
        default: null
    },
    // Storage requirements provided by the manufacturer
    storageRequirements: {
        temperature: { type: String, default: '' },
        humidity: { type: String, default: '' },
        specialRequirements: { type: String, default: '' }
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
    ,
    // Cryptographic signature of this record (sent by the creator)
    signature: {
        type: String,
        default: ''
    },
    signerPublicKey: {
        type: String,
        default: ''
    }
});

export default mongoose.model("Manufacturing", manufacturingSchema);