import express from "express";
import RetailerOrder from "../models/retailerOrderModel.js";
import DistributorInventory from "../models/distributorInventoryModel.js";
import { verifyToken, authorize } from "../middleware/roleAuth.js";
import { eventBus } from '../utils/eventBus.js';

const router = express.Router();

// Create a new order (Retailer)
router.post("/", verifyToken, authorize(['RET']), async (req, res) => {
    try {
        const { distributorId, inventoryItemId, productName, batchId, quantity, retailerName } = req.body;
        const retailerId = req.user.walletAddress;

        const newOrder = new RetailerOrder({
            retailerId,
            retailerName,
            distributorId,
            inventoryItemId,
            productName,
            batchId,
            quantity
        });

        const savedOrder = await newOrder.save();
        // Try to reserve the DistributorInventory so marketplace reflects the order
        try {
            const inv = await DistributorInventory.findById(inventoryItemId);
            if (inv) {
                // ensure sufficient quantity
                if (inv.quantity >= quantity) {
                    // try to resolve retailer name
                    let retailerNameToStore = savedOrder.retailerName || '';
                    try {
                        const UserModel = (await import('../models/user.js')).default;
                        const user = await UserModel.findOne({ walletAddress: retailerId });
                        if (user && user.name) {
                            retailerNameToStore = user.name;
                        } else {
                            // try participants collection as fallback
                            try {
                                const ParticipantModel = (await import('../models/participantModel.js')).default;
                                const part = await ParticipantModel.findOne({ address: retailerId });
                                if (part && part.name) retailerNameToStore = part.name;
                            } catch (e2) {
                                // ignore
                            }
                        }
                    } catch (e) {
                        // ignore lookup errors
                    }

                    // fallback to address if no friendly name
                    if (!retailerNameToStore) retailerNameToStore = retailerId;

                    inv.reservedFor = {
                        orderId: savedOrder._id,
                        retailerId,
                        retailerName: retailerNameToStore,
                        quantity,
                        reservedAt: new Date()
                    };
                    // mark status to indicate reservation (non-destructive)
                    inv.shippingDetails = inv.shippingDetails || {};
                    inv.shippingDetails.status = inv.shippingDetails.status || 'pending';
                    await inv.save();
                } else {
                    // If not enough stock, mark order as rejected
                    savedOrder.status = 'rejected';
                    savedOrder.rejectionReason = `Insufficient stock (available: ${inv.quantity})`;
                    await savedOrder.save();
                }
            }
        } catch (err) {
            console.error('Failed to reserve distributor inventory for order:', err);
        }

        res.status(201).json(savedOrder);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get pending orders for a distributor
router.get("/distributor/pending", verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const distributorId = req.user.walletAddress;
        // Case-insensitive match for wallet address if needed, but usually exact match
        // Assuming wallet addresses are stored consistently
        const orders = await RetailerOrder.find({
            distributorId: { $regex: new RegExp(`^${distributorId}$`, 'i') },
            status: 'pending'
        }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get orders for a retailer
router.get("/retailer/my-orders", verifyToken, authorize(['RET']), async (req, res) => {
    try {
        const retailerId = req.user.walletAddress;
        const orders = await RetailerOrder.find({
            retailerId: { $regex: new RegExp(`^${retailerId}$`, 'i') }
        }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Approve order (Distributor)
router.patch("/:id/approve", verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const { id } = req.params;
        const distributorId = req.user.walletAddress;

        const order = await RetailerOrder.findById(id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.distributorId.toLowerCase() !== distributorId.toLowerCase()) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: "Order already processed" });
        }

        // Find the inventory item
        const inventoryItem = await DistributorInventory.findById(order.inventoryItemId);
        if (!inventoryItem) {
            return res.status(404).json({ message: "Inventory item no longer exists" });
        }

        // Check if already distributed
        if (inventoryItem.distributedToRetailer && inventoryItem.distributedToRetailer.retailerId) {
            return res.status(400).json({ message: "Item already distributed to another retailer" });
        }

        // If this order had reserved the item, clear reservation and decrement quantity
        if (inventoryItem.reservedFor && inventoryItem.reservedFor.orderId && inventoryItem.reservedFor.orderId.toString() === order._id.toString()) {
            // reduce the available quantity by ordered amount
            inventoryItem.quantity = Math.max(0, inventoryItem.quantity - order.quantity);
            inventoryItem.reservedFor = { orderId: null, retailerId: '', quantity: 0, reservedAt: null };
        } else {
            // If not reserved, ensure sufficient quantity still exists
            if (inventoryItem.quantity < order.quantity) {
                return res.status(400).json({ message: `Insufficient stock to approve order (available: ${inventoryItem.quantity})` });
            }
            inventoryItem.quantity = Math.max(0, inventoryItem.quantity - order.quantity);
        }

        // Assign to retailer
        inventoryItem.distributedToRetailer = {
            retailerId: order.retailerId,
            retailerName: order.retailerName,
            distributionDate: new Date()
        };
        inventoryItem.shippingDetails = inventoryItem.shippingDetails || {};
        inventoryItem.shippingDetails.status = 'PENDING_RETAILER';

        await inventoryItem.save();

        order.status = 'approved';
        await order.save();

        // Emit event to notify clients marketplace/inventory updated
        try {
            eventBus.emit('distribution_approved', {
                orderId: order._id,
                inventoryItemId: inventoryItem._id,
                distributorId,
                retailerId: order.retailerId,
                productName: order.productName,
                quantity: order.quantity,
                timestamp: new Date()
            });
        } catch (err) {
            console.error('Failed to emit distribution_approved event:', err);
        }

        res.json({ message: "Order approved and inventory assigned", order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Reject order (Distributor)
router.patch("/:id/reject", verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const distributorId = req.user.walletAddress;

        const order = await RetailerOrder.findById(id);
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.distributorId.toLowerCase() !== distributorId.toLowerCase()) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: "Order already processed" });
        }

        order.status = 'rejected';
        order.rejectionReason = reason || '';
        await order.save();

        // If the order had reserved inventory, clear reservation
        try {
            const inv = await DistributorInventory.findById(order.inventoryItemId);
            if (inv && inv.reservedFor && inv.reservedFor.orderId && inv.reservedFor.orderId.toString() === order._id.toString()) {
                inv.reservedFor = { orderId: null, retailerId: '', quantity: 0, reservedAt: null };
                await inv.save();
            }
        } catch (err) {
            console.error('Failed to clear reservation on order rejection:', err);
        }

        res.json({ message: "Order rejected", order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
