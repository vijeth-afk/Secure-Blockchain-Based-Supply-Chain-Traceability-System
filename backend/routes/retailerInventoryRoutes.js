import express from "express";
import RetailerInventory from "../models/RetailerInventory.js";
import { verifyToken, authorize } from "../middleware/roleAuth.js";
import { verifySignature } from "../utils/crypto.js";
import { anomalyMonitor } from '../middleware/anomalyMonitor.js';

const router = express.Router();

// Get all retailer inventory items (RET, ADMIN) - allow MAN to view read-only
router.get('/', verifyToken, authorize(['RET', 'ADMIN', 'MAN']), async (req, res) => {
	try {
		const items = await RetailerInventory.find().sort({ createdAt: -1 });
		res.json(items);
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// Add new retailer inventory item
router.post('/', verifyToken, authorize(['RET', 'ADMIN']), anomalyMonitor('retailer'), async (req, res) => {
	try {
		const payload = { ...req.body };
		const signatureHex = req.body.signature || '';
		const signerPublicKey = req.body.signerPublicKey || '';

		if (signatureHex && signerPublicKey) {
			const ok = verifySignature({ payload, signatureHex, publicKeyHex: signerPublicKey });
			if (!ok) return res.status(400).json({ message: 'Invalid signature for retailer inventory entry' });
		}

		const newItem = new RetailerInventory(payload);
		const saved = await newItem.save();
		res.status(201).json(saved);
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

// Update
router.patch('/:id', verifyToken, authorize(['RET', 'ADMIN']), anomalyMonitor('retailer'), async (req, res) => {
	try {
		const { id } = req.params;
		const update = req.body;
		const item = await RetailerInventory.findById(id);
		if (!item) return res.status(404).json({ message: 'Item not found' });

		Object.keys(update).forEach(k => { item[k] = update[k]; });
		const saved = await item.save();
		res.json(saved);
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

// Delete (ADMIN only)
router.delete('/:id', verifyToken, authorize(['ADMIN']), async (req, res) => {
	try {
		const { id } = req.params;
		const item = await RetailerInventory.findById(id);
		if (!item) return res.status(404).json({ message: 'Item not found' });
		await item.remove();
		res.json({ message: 'Item deleted' });
	} catch (err) {
		res.status(400).json({ message: err.message });
	}
});

export default router;
