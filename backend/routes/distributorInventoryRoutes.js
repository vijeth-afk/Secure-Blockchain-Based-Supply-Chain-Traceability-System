import express from "express";
import DistributorInventory from "../models/distributorInventoryModel.js";
import User from '../models/user.js';
import Participant from '../models/participantModel.js';
import { verifyToken, authorize } from "../middleware/roleAuth.js";
import { verifySignature } from "../utils/crypto.js";
import { anomalyMonitor } from '../middleware/anomalyMonitor.js';

const router = express.Router();

// Get all inventory items (DIS, ADMIN, RET and MAN for marketplace / manufacturer view)
router.get("/", verifyToken, authorize(['DIS', 'ADMIN', 'RET', 'MAN']), async (req, res) => {
    try {
        const items = await DistributorInventory.find().sort({ createdAt: -1 });
        try {
            console.log(`[distributor-inventory] GET by ${req.user?.walletAddress || 'unknown'} role=${req.user?.role || 'unknown'} -> ${items.length} items`);
        } catch (e) { /* ignore logging errors */ }

        // Enrich items that lack distributorName by looking up User/Participant records.
        const enriched = await Promise.all(items.map(async it => {
            // convert mongoose doc to plain object
            const obj = (typeof it.toObject === 'function') ? it.toObject() : it;
            if (!obj.distributorName || obj.distributorName === '') {
                try {
                    const distAddr = (obj.distributorId || '').toString();
                    if (distAddr) {
                        const user = await User.findOne({ walletAddress: distAddr });
                        if (user && user.name) {
                            obj.distributorName = user.name;
                        } else {
                            const part = await Participant.findOne({ address: distAddr });
                            if (part && part.name) obj.distributorName = part.name;
                        }
                    }
                } catch (e) {
                    // ignore lookup errors
                }
                if (!obj.distributorName) obj.distributorName = obj.distributorId;
            }
            return obj;
        }));

        res.json(enriched);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get inventory items by distributor ID (allow MAN to view distributor-specific inventory)
router.get("/distributor/:distributorId", verifyToken, authorize(['DIS', 'ADMIN', 'MAN']), async (req, res) => {
    try {
        const items = await DistributorInventory.find({
            distributorId: req.params.distributorId
        }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new inventory item
router.post("/", verifyToken, authorize(['DIS', 'ADMIN']), anomalyMonitor('distributor'), async (req, res) => {
    try {
        const payload = { ...req.body };

        const signatureHex = req.body.signature || '';
        const signerPublicKey = req.body.signerPublicKey || '';

        if (signatureHex && signerPublicKey) {
            const ok = verifySignature({ payload, signatureHex, publicKeyHex: signerPublicKey });
            if (!ok) {
                return res.status(400).json({ message: 'Invalid signature for distributor inventory entry' });
            }
        }

        const newItem = new DistributorInventory(payload);
        const savedItem = await newItem.save();

        res.status(201).json(savedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update inventory item (including distribution to retailer)
router.patch("/:id", verifyToken, authorize(['DIS', 'ADMIN']), anomalyMonitor('distributor'), async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;

        const item = await DistributorInventory.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // If requester is DIS, enforce ownership
        if (req.user.role === 'DIS') {
            const requesterWallet = (req.user.walletAddress || '').toLowerCase();
            const itemDistributor = (item.distributorId || '').toLowerCase();
            if (!requesterWallet || requesterWallet !== itemDistributor) {
                return res.status(403).json({ message: 'Access denied. You can only update your own inventory items.' });
            }
        }

        // Check if distributing to retailer
        const wasDistributed = !item.distributedToRetailer?.retailerId;
        const isNowDistributed = update.distributedToRetailer?.retailerId;

        // Update fields
        Object.keys(update).forEach(key => {
            item[key] = update[key];
        });

        // If distributing to retailer for the first time, set status to PENDING_RETAILER
        if (wasDistributed && isNowDistributed) {
            item.shippingDetails.status = 'PENDING_RETAILER';

            // Emit Socket.io notification to retailer
            const io = req.app.get('io');
            if (io) {
                io.emit('shipment_sent', {
                    distributionId: item._id,
                    retailerId: item.distributedToRetailer.retailerId,
                    distributorId: item.distributorId,
                    productName: item.productName,
                    quantity: item.quantity,
                    timestamp: new Date()
                });
            }
        }

        const savedItem = await item.save();
        res.json(savedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete inventory item
router.delete("/:id", verifyToken, authorize(['DIS', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const item = await DistributorInventory.findById(id);

        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // If requester is DIS, enforce ownership
        if (req.user.role === 'DIS') {
            const requesterWallet = (req.user.walletAddress || '').toLowerCase();
            const itemDistributor = (item.distributorId || '').toLowerCase();
            if (!requesterWallet || requesterWallet !== itemDistributor) {
                return res.status(403).json({ message: 'Access denied. You can only delete your own inventory items.' });
            }
        }

        await item.deleteOne();
        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

export default router;