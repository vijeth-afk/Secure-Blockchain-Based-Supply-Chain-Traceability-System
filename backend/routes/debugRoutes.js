import express from 'express';
import DistributorInventory from '../models/distributorInventoryModel.js';
import User from '../models/user.js';

const router = express.Router();

// Temporary debug endpoint (no auth) to inspect distributor inventory contents
// Only intended for local dev; remove or protect before production
router.get('/distributor-inventory', async (req, res) => {
    try {
        const items = await DistributorInventory.find().sort({ createdAt: -1 }).limit(200);
        res.json({ count: items.length, items });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Debug endpoint to list User documents (DEV ONLY)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(200);
        res.json({ count: users.length, users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
