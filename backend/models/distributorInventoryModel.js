import mongoose from "mongoose";

const distributorInventorySchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true
    },
    productName: {
        type: String,
        required: true
    },
    receivedFromManufacturer: {
        manufacturerId: String,
        manufacturerName: String,
        receiptDate: Date
    },
    distributedToRetailer: {
        retailerId: String,
        retailerName: String,
        distributionDate: Date
    },
    storageConditions: {
        temperature: String,
        humidity: String,
        specialRequirements: String
    },
    warehouseLocation: {
        address: String,
        section: String,
        shelf: String
    },
    shippingDetails: {
        status: {
            type: String,
            enum: ['pending', 'in-transit', 'delivered', 'PENDING_RETAILER', 'AT_RETAILER', 'REJECTED_BY_RETAILER'],
            default: 'pending'
        },
        cost: Number,
        expectedDeliveryDate: Date
    },
    // Retailer acceptance tracking
    acceptedByRetailer: {
        type: Boolean,
        default: false
    },
    acceptedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    // Reservation when a retailer places an order but distributor hasn't approved yet
    reservedFor: {
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'RetailerOrder', default: null },
        retailerId: { type: String, default: '' },
        quantity: { type: Number, default: 0 },
        reservedAt: { type: Date, default: null }
    },
    distributorId: {
        type: String,
        required: true
    },
    distributorName: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // optional cryptographic proof that the distributor signed this entry
    signature: {
        type: String,
        default: ''
    },
    signerPublicKey: {
        type: String,
        default: ''
    }
});

// Update timestamp on save
distributorInventorySchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model("DistributorInventory", distributorInventorySchema);