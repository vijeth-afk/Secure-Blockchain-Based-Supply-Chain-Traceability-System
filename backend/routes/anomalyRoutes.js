import express from "express";
import AnomalyAlert from "../models/anomalyAlertModel.js";
import anomalyDetector from "../services/anomalyDetector.js";
import { verifyToken, authorize } from "../middleware/roleAuth.js";

const router = express.Router();

// GET → Fetch all anomaly alerts with filtering
router.get("/", verifyToken, async (req, res) => {
    try {
        const { severity, status, affectedEntity, startDate, endDate, limit = 50, skip = 0 } = req.query;

        const filter = {};
        if (severity) filter.severity = severity;
        if (status) filter.status = status;
        if (affectedEntity) filter.affectedEntity = affectedEntity;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const alerts = await AnomalyAlert.find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await AnomalyAlert.countDocuments(filter);

        res.json({
            alerts,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET → Get specific anomaly alert by ID
router.get("/:id", verifyToken, async (req, res) => {
    try {
        const alert = await AnomalyAlert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ message: "Alert not found" });
        }
        res.json(alert);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PATCH → Acknowledge an anomaly alert
router.patch("/:id/acknowledge", verifyToken, async (req, res) => {
    try {
        const alert = await AnomalyAlert.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ message: "Alert not found" });
        }

        if (alert.status === 'new') {
            alert.status = 'acknowledged';
            alert.acknowledgedBy = req.user.walletAddress || req.user.email || 'unknown';
            alert.acknowledgedAt = new Date();
            await alert.save();
        }

        res.json(alert);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PATCH → Resolve an anomaly alert
router.patch("/:id/resolve", verifyToken, async (req, res) => {
    try {
        const { resolutionNotes, isFalsePositive } = req.body;
        const alert = await AnomalyAlert.findById(req.params.id);

        if (!alert) {
            return res.status(404).json({ message: "Alert not found" });
        }

        alert.status = isFalsePositive ? 'false_positive' : 'resolved';
        alert.resolvedBy = req.user.walletAddress || req.user.email || 'unknown';
        alert.resolvedAt = new Date();
        if (resolutionNotes) {
            alert.resolutionNotes = resolutionNotes;
        }
        await alert.save();

        res.json(alert);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// POST → Trigger manual anomaly scan (ADMIN only)
router.post("/scan", verifyToken, authorize(['ADMIN']), async (req, res) => {
    try {
        console.log("🔍 Manual anomaly scan triggered by:", req.user.email || req.user.walletAddress);
        const results = await anomalyDetector.scanAll();

        res.json({
            message: "Anomaly scan completed",
            results: {
                raw_material: results.raw_material.length,
                manufacturing: results.manufacturing.length,
                distributor: results.distributor.length,
                retailer: results.retailer.length,
                total: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET → Get anomaly statistics
router.get("/stats/summary", verifyToken, async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const stats = await AnomalyAlert.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    critical: {
                        $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] }
                    },
                    high: {
                        $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] }
                    },
                    medium: {
                        $sum: { $cond: [{ $eq: ["$severity", "medium"] }, 1, 0] }
                    },
                    low: {
                        $sum: { $cond: [{ $eq: ["$severity", "low"] }, 1, 0] }
                    },
                    new: {
                        $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] }
                    },
                    acknowledged: {
                        $sum: { $cond: [{ $eq: ["$status", "acknowledged"] }, 1, 0] }
                    },
                    resolved: {
                        $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                    }
                }
            }
        ]);

        const bySeverity = await AnomalyAlert.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: "$severity",
                    count: { $sum: 1 }
                }
            }
        ]);

        const byType = await AnomalyAlert.aggregate([
            {
                $match: {
                    timestamp: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: "$anomalyType",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            summary: stats[0] || {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                new: 0,
                acknowledged: 0,
                resolved: 0
            },
            bySeverity,
            byType,
            period: `Last ${days} days`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
