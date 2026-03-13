import express from 'express';
import DistributionRequest from '../models/distributionRequestModel.js';
import Manufacturing from '../models/manufacturingModel.js';
import User from '../models/user.js';
import DistributorInventory from '../models/distributorInventoryModel.js';
import { verifyToken, authorize } from '../middleware/roleAuth.js';
import { eventBus } from '../utils/eventBus.js';

const router = express.Router();

// Create a distribution request (Manufacturer initiates distribution to Distributor)
// POST /api/distribution-requests
router.post('/', verifyToken, authorize(['MAN']), async (req, res) => {
    try {
        const { manufacturingId, distributorId, quantity } = req.body;
        const manufacturerId = req.user.walletAddress;

        // Validate manufacturing item exists and belongs to manufacturer
        const manufacturing = await Manufacturing.findById(manufacturingId);
        if (!manufacturing) {
            return res.status(404).json({ error: 'Manufacturing item not found' });
        }

        // Normalize addresses for comparison
        const manuAddr = (manufacturing.manufacturer || '').toString().toLowerCase();
        const requesterAddr = (manufacturerId || '').toString().toLowerCase();
        if (!manuAddr || manuAddr !== requesterAddr) {
            return res.status(403).json({ error: 'Manufacturing item does not belong to you' });
        }

        if (manufacturing.quantity < quantity) {
            return res.status(400).json({ error: `Insufficient quantity. Available: ${manufacturing.quantity}` });
        }

        // Fetch manufacturer and distributor names
        const manufacturer = await User.findOne({ walletAddress: manufacturerId });
        const distributor = await User.findOne({ walletAddress: distributorId });

        const distributionRequest = new DistributionRequest({
            manufacturingId,
            batchId: manufacturing.batchId,
            productName: manufacturing.productName,
            quantity,
            manufacturerId,
            manufacturerName: manufacturer?.name || 'Unknown',
            distributorId,
            distributorName: distributor?.name || 'Unknown',
            storageRequirements: manufacturing.storageRequirements || {}
        });

        await distributionRequest.save();

        // Emit SSE event for real-time notification
        eventBus.emit('distribution_created', {
            id: distributionRequest._id,
            distributorId,
            manufacturerName: manufacturer?.name || 'Unknown',
            productName: manufacturing.productName,
            quantity,
            timestamp: new Date()
        });

        res.status(201).json({
            message: 'Distribution request created successfully',
            distributionRequest
        });
    } catch (error) {
        console.error('Error creating distribution request:', error);
        res.status(500).json({ error: 'Failed to create distribution request' });
    }
});

// Get pending distribution requests for a distributor
// GET /api/distribution-requests/pending
router.get('/pending', verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const distributorId = req.user.walletAddress;

        const pendingRequests = await DistributionRequest.find({
            distributorId,
            status: 'pending'
        }).sort({ createdAt: -1 });

        res.json(pendingRequests);
    } catch (error) {
        console.error('Error fetching pending distribution requests:', error);
        res.status(500).json({ error: 'Failed to fetch pending distribution requests' });
    }
});

// Get all distribution requests for a manufacturer
// GET /api/distribution-requests/sent
router.get('/sent', verifyToken, authorize(['MAN']), async (req, res) => {
    try {
        const manufacturerId = req.user.walletAddress;

        const sentRequests = await DistributionRequest.find({
            manufacturerId
        }).sort({ createdAt: -1 });

        res.json(sentRequests);
    } catch (error) {
        console.error('Error fetching sent distribution requests:', error);
        res.status(500).json({ error: 'Failed to fetch sent distribution requests' });
    }
});

// Approve a distribution request (Distributor approves)
// PATCH /api/distribution-requests/:id/approve
router.patch('/:id/approve', verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const { id } = req.params;
        const distributorId = req.user.walletAddress;

        const distributionRequest = await DistributionRequest.findById(id);
        if (!distributionRequest) {
            return res.status(404).json({ error: 'Distribution request not found' });
        }

        if ((distributionRequest.distributorId || '').toString().toLowerCase() !== (distributorId || '').toString().toLowerCase()) {
            return res.status(403).json({ error: 'You are not the intended distributor' });
        }

        if (distributionRequest.status !== 'pending') {
            return res.status(400).json({ error: `Cannot approve a ${distributionRequest.status} request` });
        }

        // Update distribution request status
        distributionRequest.status = 'approved';
        distributionRequest.approvedBy = distributorId;
        distributionRequest.approvedAt = new Date();
        await distributionRequest.save();

        // Decrement manufacturing quantity
        const manufacturing = await Manufacturing.findById(distributionRequest.manufacturingId);
        if (manufacturing) {
            manufacturing.quantity -= distributionRequest.quantity;
            await manufacturing.save();
        }

        // Create a DistributorInventory entry so retail marketplace can list available stock
        try {
            const distPayload = {
                batchId: distributionRequest.batchId,
                productName: distributionRequest.productName,
                receivedFromManufacturer: {
                    manufacturerId: distributionRequest.manufacturerId,
                    manufacturerName: distributionRequest.manufacturerName || distributionRequest.manufacturerId
                },
                storageConditions: distributionRequest.storageRequirements || {},
                distributorId: distributionRequest.distributorId,
                distributorName: distributionRequest.distributorName || distributionRequest.distributorId,
                quantity: distributionRequest.quantity,
                shippingDetails: { status: 'pending', expectedDeliveryDate: null }
            };

            // Try to resolve nicer names if possible
            const manuUser = await User.findOne({ walletAddress: distributionRequest.manufacturerId });
            if (manuUser) distPayload.receivedFromManufacturer.manufacturerName = manuUser.name;
            const distUser = await User.findOne({ walletAddress: distributionRequest.distributorId });
            if (distUser) distPayload.distributorName = distUser.name;

            const distItem = new DistributorInventory(distPayload);
            const savedDistItem = await distItem.save();

            // Emit SSE event for real-time clients (existing stream listens for this)
            eventBus.emit('distributor_inventory_created', savedDistItem);
        } catch (err) {
            console.error('Failed to create DistributorInventory from distribution approval:', err);
        }

        // Emit SSE event for distribution approval as well
        eventBus.emit('distribution_approved', {
            id: distributionRequest._id,
            manufacturerId: distributionRequest.manufacturerId,
            distributorName: distributionRequest.distributorName,
            productName: distributionRequest.productName,
            quantity: distributionRequest.quantity,
            timestamp: new Date()
        });

        res.json({
            message: 'Distribution request approved successfully',
            distributionRequest
        });
    } catch (error) {
        console.error('Error approving distribution request:', error);
        res.status(500).json({ error: 'Failed to approve distribution request' });
    }
});

// Reject a distribution request (Distributor rejects)
// PATCH /api/distribution-requests/:id/reject
router.patch('/:id/reject', verifyToken, authorize(['DIS']), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const distributorId = req.user.walletAddress;

        const distributionRequest = await DistributionRequest.findById(id);
        if (!distributionRequest) {
            return res.status(404).json({ error: 'Distribution request not found' });
        }

        if ((distributionRequest.distributorId || '').toString().toLowerCase() !== (distributorId || '').toString().toLowerCase()) {
            return res.status(403).json({ error: 'You are not the intended distributor' });
        }

        if (distributionRequest.status !== 'pending') {
            return res.status(400).json({ error: `Cannot reject a ${distributionRequest.status} request` });
        }

        // Update distribution request status
        distributionRequest.status = 'rejected';
        distributionRequest.rejectionReason = reason || '';
        await distributionRequest.save();

        // Emit SSE event for real-time notification
        eventBus.emit('distribution_rejected', {
            id: distributionRequest._id,
            manufacturerId: distributionRequest.manufacturerId,
            productName: distributionRequest.productName,
            quantity: distributionRequest.quantity,
            reason: reason || '',
            timestamp: new Date()
        });

        res.json({
            message: 'Distribution request rejected',
            distributionRequest
        });
    } catch (error) {
        console.error('Error rejecting distribution request:', error);
        res.status(500).json({ error: 'Failed to reject distribution request' });
    }
});

export default router;
