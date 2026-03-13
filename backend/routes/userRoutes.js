import express from 'express';
import User from '../models/user.js';
import { verifyToken, authorize } from '../middleware/roleAuth.js';

const router = express.Router();

// GET /api/users?role=DIS - list users filtered by role (protected)
router.get('/', verifyToken, authorize(['ADMIN','MAN','DIS','RET','SUP']), async (req, res) => {
    try {
        const { role } = req.query;
        const query = {};
        if (role) query.role = role;
        const users = await User.find(query).select('name walletAddress role email createdAt');
        res.json(users);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

export default router;
