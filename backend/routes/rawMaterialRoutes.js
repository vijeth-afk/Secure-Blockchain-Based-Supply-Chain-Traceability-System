import express from "express";
import RawMaterial from "../models/rawMaterialModel.js";
import User from "../models/user.js";
import Participant from "../models/participantModel.js";
import { verifyToken, authorize } from '../middleware/roleAuth.js';
import { anomalyMonitor } from '../middleware/anomalyMonitor.js';

const router = express.Router();

// ===============================
// GET → Fetch all raw materials
// ===============================
// GET → Fetch all raw materials (authenticated users)
router.get("/", verifyToken, async (req, res) => {
    try {
        console.log('GET /api/rawmaterials - User:', req.user?.email || req.user?.walletAddress);

        const materials = await RawMaterial.find().sort({ timestamp: -1 });
        console.log(`GET /api/rawmaterials - Found ${materials.length} materials`);

        // Populate manufacturer names for materials that have been requested
        const materialsWithNames = await Promise.all(materials.map(async (material) => {
            const materialObj = material.toObject();

            // If material has been requested, fetch the requester's name and email
            if (materialObj.requestedBy) {
                const requester = await User.findOne({ walletAddress: materialObj.requestedBy });
                if (requester) {
                    materialObj.requesterName = requester.name;
                    materialObj.requesterEmail = requester.email;
                }
            }

            // If material has a manufacturer address, attempt to enrich with their name/email
            if (materialObj.manufacturerAddress) {
                const manu = await User.findOne({ walletAddress: materialObj.manufacturerAddress });
                if (manu) {
                    materialObj.manufacturerName = materialObj.manufacturerName || manu.name;
                    materialObj.manufacturerEmail = manu.email || materialObj.manufacturerEmail;
                }
            }

                // Enrich addedBy with user/participant name when available
                if (materialObj.addedBy) {
                    try {
                        const addedAddr = materialObj.addedBy.toString();
                        const addedUser = await User.findOne({ walletAddress: addedAddr });
                        if (addedUser && addedUser.name) {
                            materialObj.addedByName = addedUser.name;
                            materialObj.addedByAddress = addedAddr;
                        } else {
                            const addedPart = await Participant.findOne({ address: addedAddr });
                            if (addedPart && addedPart.name) {
                                materialObj.addedByName = addedPart.name;
                                materialObj.addedByAddress = addedAddr;
                            } else {
                                materialObj.addedByAddress = addedAddr;
                            }
                        }
                    } catch (e) {
                        materialObj.addedByAddress = materialObj.addedBy;
                    }
                }

            return materialObj;
        }));

        res.json(materialsWithNames);
    } catch (error) {
        console.error('GET /api/rawmaterials - Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST → Add new raw material (SUP and ADMIN)
router.post("/", verifyToken, authorize(['SUP', 'ADMIN']), anomalyMonitor('raw_material'), async (req, res) => {
    try {
        console.log('POST /api/rawmaterials - Request body:', req.body);
        console.log('POST /api/rawmaterials - User:', req.user);

        const payload = { ...req.body };
        // ensure addedBy comes from the authenticated user if available
        if (req.user && req.user.walletAddress) payload.addedBy = req.user.walletAddress;

        console.log('POST /api/rawmaterials - Final payload:', payload);

        const newMaterial = new RawMaterial(payload);
        const savedMaterial = await newMaterial.save();

        console.log('POST /api/rawmaterials - Success:', savedMaterial._id);
        res.status(201).json(savedMaterial);
    } catch (error) {
        console.error('POST /api/rawmaterials - Error:', error.message);
        res.status(400).json({ message: error.message });
    }
});

// PUT → Update full material details (SUP can update their own items; ADMIN can update any)
router.put("/:id", verifyToken, authorize(['SUP', 'ADMIN']), anomalyMonitor('raw_material'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;

        const material = await RawMaterial.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }
        // If SUP is making the request, ensure ownership
        if (req.user.role === 'SUP') {
            const requester = (req.user.walletAddress || '').toLowerCase();
            const owner = (material.addedBy || '').toLowerCase();
            if (requester !== owner) {
                return res.status(403).json({ message: 'Access denied. You can only update your own raw materials.' });
            }
        }

        Object.assign(material, updateFields, { timestamp: new Date() });
        const updatedMaterial = await material.save();

        res.json(updatedMaterial);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ===============================
// PATCH → Update quantity only (legacy support)
// ===============================
router.patch("/:id", verifyToken, authorize(['SUP', 'ADMIN']), anomalyMonitor('raw_material'), async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity } = req.body;

        const material = await RawMaterial.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }

        if (req.user.role === 'SUP') {
            const requester = (req.user.walletAddress || '').toLowerCase();
            const owner = (material.addedBy || '').toLowerCase();
            if (requester !== owner) {
                return res.status(403).json({ message: 'Access denied. You can only update your own raw materials.' });
            }
        }

        material.quantity = quantity;
        material.timestamp = new Date();
        const updatedMaterial = await material.save();

        res.json(updatedMaterial);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ===============================
// PATCH → Mark as sold & store manufacturer name (any authenticated user can mark as sold via this endpoint)
// ===============================
router.patch("/:id/sell", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { manufacturerName, manufacturerAddress } = req.body;

        const material = await RawMaterial.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }

        material.sold = true;
        material.manufacturerName = manufacturerName || material.manufacturerName || "Unknown Manufacturer";
        material.manufacturerAddress = manufacturerAddress || material.manufacturerAddress || '';
        material.timestamp = new Date();
        const updatedMaterial = await material.save();

        res.json(updatedMaterial);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// ===============================
// PATCH → Manufacturer verifies/approves or rejects a raw material batch
// Only MAN and ADMIN can perform this action
// Body: { action: 'approve'|'reject' }
// ===============================
router.patch('/:id/verify', verifyToken, authorize(['MAN', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        const material = await RawMaterial.findById(id);
        if (!material) return res.status(404).json({ message: 'Material not found' });

        if (!['approve', 'reject', 'request'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action' });
        }

        if (action === 'request') {
            const { requestedQuantity, requestedStorage } = req.body;

            // Validation
            if (!requestedQuantity || requestedQuantity <= 0) {
                return res.status(400).json({ message: 'Requested quantity must be greater than 0' });
            }

            if (requestedQuantity > material.quantity) {
                return res.status(400).json({
                    message: `Requested quantity (${requestedQuantity}) exceeds available quantity (${material.quantity} ${material.unit})`
                });
            }

            material.status = 'requested';
            material.requestedBy = req.user.walletAddress || req.user.email || '';
            material.requestedAt = new Date();
            material.requestedQuantity = requestedQuantity;
            // save optional storage requirements (temperature, humidity, specialRequirements)
            if (requestedStorage && typeof requestedStorage === 'object') {
                material.requestedStorage = {
                    temperature: requestedStorage.temperature || '',
                    humidity: requestedStorage.humidity || '',
                    specialRequirements: requestedStorage.specialRequirements || ''
                };
            }
        } else {
            // approve or reject
            material.status = action === 'approve' ? 'approved' : 'rejected';
            material.approvedBy = req.user.walletAddress || req.user.email || '';
            material.approvedAt = new Date();
            // clear any previous request metadata
            material.requestedBy = material.requestedBy || '';
            material.requestedAt = material.requestedAt || null;
        }
        material.timestamp = new Date();

        const updated = await material.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ===============================
// PATCH → Supplier responds to a request (accept & optionally mark sold, or reject)
// Only SUP and ADMIN can perform this action
// Body: { action: 'accept'|'reject', markSold: boolean, manufacturerName?: string }
// ===============================
router.patch('/:id/respond', verifyToken, authorize(['SUP', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { action, markSold, manufacturerName, manufacturerAddress } = req.body;

        const material = await RawMaterial.findById(id);
        if (!material) return res.status(404).json({ message: 'Material not found' });

        // Only respond to requested items
        if (material.status !== 'requested') {
            return res.status(400).json({ message: 'Material is not in requested state' });
        }

        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'Invalid action' });
        }

        if (action === 'reject') {
            material.status = 'rejected';
            // clear request metadata
            material.requestedQuantity = 0;
            material.requestedBy = '';
            material.requestedAt = null;
        } else if (action === 'accept') {
            // determine quantity to transfer (prefer recorded requestedQuantity)
            const qtyToTransfer = material.requestedQuantity && material.requestedQuantity > 0
                ? material.requestedQuantity
                : (Number(req.body.requestedQuantity) || 0);

            if (!qtyToTransfer || qtyToTransfer <= 0) {
                return res.status(400).json({ message: 'No requested quantity to accept' });
            }

            if (qtyToTransfer > material.quantity) {
                return res.status(400).json({ message: `Requested quantity (${qtyToTransfer}) exceeds available quantity (${material.quantity})` });
            }

            // decrement available quantity by the requested amount
            material.quantity = material.quantity - qtyToTransfer;

            material.status = 'approved';
            material.approvedBy = req.user.walletAddress || req.user.email || '';
            material.approvedAt = new Date();

            // If marking sold, mark only when the remaining quantity is zero; record manufacturer name for this transfer
            if (markSold) {
                if (material.quantity === 0) {
                    material.sold = true;
                }
                // determine manufacturer name and address
                let finalManufacturerName = manufacturerName || '';
                let finalManufacturerAddress = manufacturerName && !manufacturerAddress ? '' : (manufacturerAddress || '');

                // prefer material.requestedBy as manufacturer address if available
                if (!finalManufacturerAddress && material.requestedBy) {
                    finalManufacturerAddress = material.requestedBy;
                }

                // if address is known but name not provided, try to lookup user
                if (finalManufacturerAddress && !finalManufacturerName) {
                    const manuUser = await User.findOne({ walletAddress: finalManufacturerAddress });
                    if (manuUser) finalManufacturerName = manuUser.name;
                }

                material.manufacturerName = finalManufacturerName || material.manufacturerName || '';
                material.manufacturerAddress = finalManufacturerAddress || material.manufacturerAddress || '';
            }

            // clear request metadata now that it has been handled
            material.requestedQuantity = 0;
            material.requestedBy = '';
            material.requestedAt = null;
        }

        material.timestamp = new Date();
        const updated = await material.save();
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ===============================
// DELETE → Remove a raw material
// ===============================
router.delete("/:id", verifyToken, authorize(['SUP', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;

        const material = await RawMaterial.findById(id);
        if (!material) {
            return res.status(404).json({ message: "Material not found" });
        }

        if (req.user.role === 'SUP') {
            const requester = (req.user.walletAddress || '').toLowerCase();
            const owner = (material.addedBy || '').toLowerCase();
            if (requester !== owner) {
                return res.status(403).json({ message: 'Access denied. You can only delete your own raw materials.' });
            }
        }

        await material.remove();
        res.json({ message: "Material deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
