import express from "express";
import Participant from "../models/participantModel.js";
import { verifyToken, authorize } from "../middleware/roleAuth.js";

const router = express.Router();

// POST → Add participant (ADMIN only)
router.post("/", verifyToken, authorize(['ADMIN']), async (req, res) => {
    try {
        const newParticipant = new Participant(req.body);
        await newParticipant.save();
        res.status(201).json({ message: "Participant saved successfully", data: newParticipant });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET → Get all participants (Accessible by all authenticated roles)
router.get("/", verifyToken, authorize(['ADMIN', 'MAN', 'DIS', 'RET', 'SUP']), async (req, res) => {
    try {
        const { role } = req.query;
        let query = {};

        if (role) {
            query.role = role;
        }

        const participants = await Participant.find(query).sort({ createdAt: -1 });
        res.json(participants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
