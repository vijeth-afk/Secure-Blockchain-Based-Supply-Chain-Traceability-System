import express from "express";
import Manufacturing from "../models/manufacturingModel.js";
import DistributorInventory from "../models/distributorInventoryModel.js";
import User from "../models/user.js";
import eventBus from '../utils/eventBus.js';
import { verifyToken, authorize } from "../middleware/roleAuth.js";
import { verifySignature } from "../utils/crypto.js";
import { anomalyMonitor } from '../middleware/anomalyMonitor.js';

const router = express.Router();

// Get all manufacturing entries (MAN and ADMIN)
router.get("/", verifyToken, authorize(['MAN', 'ADMIN']), async (req, res) => {
    try {
        const items = await Manufacturing.find().sort({ productionDate: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new manufacturing entry
router.post("/", verifyToken, authorize(['MAN', 'ADMIN']), anomalyMonitor('manufacturing'), async (req, res) => {
    try {
        const payload = { ...req.body };

        // Force manufacturer to be the authenticated user's wallet address
        // to prevent clients from spoofing ownership.
        if (req.user && req.user.walletAddress) {
            payload.manufacturer = req.user.walletAddress;
        }

        // If client provided signature and publicKey, verify it before saving
        const signatureHex = req.body.signature || '';
        const signerPublicKey = req.body.signerPublicKey || '';

        if (signatureHex && signerPublicKey) {
            const ok = verifySignature({ payload, signatureHex, publicKeyHex: signerPublicKey });
            if (!ok) {
                return res.status(400).json({ message: 'Invalid signature for manufacturing entry' });
            }
        }

        const newItem = new Manufacturing(payload);
        let savedItem = await newItem.save();

        // Support optional immediate dispatch: payload.dispatch = { distributorId, distributorName, quantity }
        if (payload.dispatch && payload.dispatch.distributorId && payload.dispatch.quantity) {
            try {
                const { distributorId, distributorName, quantity } = payload.dispatch;
                const qty = Number(quantity || 0);
                if (qty > 0 && qty <= savedItem.quantity) {
                    const distPayload = {
                        batchId: savedItem.batchId,
                        productName: savedItem.productName,
                        receivedFromManufacturer: {
                            manufacturerId: savedItem.manufacturer,
                            manufacturerName: savedItem.manufacturer
                        },
                        storageConditions: savedItem.storageRequirements || {},
                        distributorId,
                        quantity: qty,
                        shippingDetails: { status: 'pending', expectedDeliveryDate: null }
                    };

                    if (savedItem.manufacturer) {
                        const manu = await User.findOne({ walletAddress: savedItem.manufacturer });
                        if (manu) distPayload.receivedFromManufacturer.manufacturerName = manu.name;
                    }

                    if (distributorName) distPayload.distributorName = distributorName;
                    else {
                        const distUser = await User.findOne({ walletAddress: distributorId });
                        if (distUser) distPayload.distributorName = distUser.name;
                    }

                    const newDistItem = new DistributorInventory(distPayload);
                    const savedDist = await newDistItem.save();

                    // decrement manufacturing quantity and update status if depleted
                    savedItem.quantity = savedItem.quantity - qty;
                    if (savedItem.quantity === 0) savedItem.status = 'shipped';
                    savedItem = await savedItem.save();

                    // emit event for real-time clients
                    eventBus.emit('distributor_inventory_created', savedDist);
                }
            } catch (err) {
                console.error('Auto-dispatch failed:', err);
            }
        }

        res.status(201).json(savedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete manufacturing entry
router.delete("/:id", verifyToken, authorize(['ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const item = await Manufacturing.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        await item.remove();
        res.json({ message: "Item deleted successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update manufacturing entry status
router.patch("/:id", verifyToken, authorize(['MAN', 'ADMIN']), anomalyMonitor('manufacturing'), async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;

        const item = await Manufacturing.findById(id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        Object.keys(update).forEach(key => {
            item[key] = update[key];
        });

        const updatedItem = await item.save();
        res.json(updatedItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Dispatch manufactured quantity to a Distributor (create DistributorInventory entry)
// Body: { distributorId, distributorName?, quantity }
router.post('/:id/dispatch', verifyToken, authorize(['MAN', 'ADMIN']), anomalyMonitor('manufacturing-dispatch'), async (req, res) => {
    try {
        const { id } = req.params;
        const { distributorId, distributorName, quantity } = req.body;

        if (!distributorId) return res.status(400).json({ message: 'distributorId is required' });
        const qty = Number(quantity || 0);
        if (!qty || qty <= 0) return res.status(400).json({ message: 'quantity must be > 0' });

        const item = await Manufacturing.findById(id);
        if (!item) return res.status(404).json({ message: 'Manufacturing item not found' });

        if (qty > item.quantity) return res.status(400).json({ message: `Requested quantity (${qty}) exceeds available manufactured quantity (${item.quantity})` });

        // Build distributor inventory payload
        const distPayload = {
            batchId: item.batchId,
            productName: item.productName,
            receivedFromManufacturer: {
                manufacturerId: item.manufacturer,
                manufacturerName: item.manufacturer // may be address; try resolving below
            },
            storageConditions: item.storageRequirements || {},
            distributorId,
            quantity: qty,
            shippingDetails: { status: 'pending', expectedDeliveryDate: null }
        };

        // Try to resolve manufacturer name from User model
        if (item.manufacturer) {
            const manu = await User.findOne({ walletAddress: item.manufacturer });
            if (manu) distPayload.receivedFromManufacturer.manufacturerName = manu.name;
        }

        // If distributorName not provided, try lookup
        if (!distributorName) {
            const distUser = await User.findOne({ walletAddress: distributorId });
            if (distUser) distPayload.distributorName = distUser.name;
        } else {
            distPayload.distributorName = distributorName;
        }

        const newDistItem = new DistributorInventory(distPayload);
        const saved = await newDistItem.save();

        // decrement manufacturing quantity
        item.quantity = item.quantity - qty;
        // if depleted, set status to 'shipped' maybe, or keep as-is
        if (item.quantity === 0) item.status = 'shipped';
        await item.save();

        // emit event for real-time clients
        eventBus.emit('distributor_inventory_created', saved);

        res.status(201).json({ distributorItem: saved, manufacturingItem: item });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;