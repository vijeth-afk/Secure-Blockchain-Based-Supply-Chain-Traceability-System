import express from 'express';
import DistributorInventory from '../models/distributorInventoryModel.js';
import RetailerInventory from '../models/RetailerInventory.js';
import { verifyToken, authorize } from '../middleware/roleAuth.js';
import { transferToRetailer, recordSale } from '../utils/blockchainStub.js';

const router = express.Router();

/**
 * GET /api/retailer/incoming
 * View all incoming shipments pending retailer acceptance
 */
router.get('/incoming', verifyToken, authorize(['RET', 'ADMIN']), async (req, res) => {
    try {
        const retailerId = req.user.walletAddress;

        const pendingShipments = await DistributorInventory.find({
            'distributedToRetailer.retailerId': retailerId,
            'shippingDetails.status': 'PENDING_RETAILER'
        }).sort({ 'distributedToRetailer.distributionDate': -1 });

        res.json(pendingShipments);
    } catch (error) {
        console.error('Error fetching incoming shipments:', error);
        res.status(500).json({ error: 'Failed to fetch incoming shipments' });
    }
});

/**
 * POST /api/retailer/accept
 * Accept an incoming shipment from distributor
 */
router.post('/accept', verifyToken, authorize(['RET']), async (req, res) => {
    try {
        const { distributionId } = req.body;
        const retailerId = req.user.walletAddress;

        if (!distributionId) {
            return res.status(400).json({ error: 'distributionId is required' });
        }

        // Find the distribution
        const distribution = await DistributorInventory.findById(distributionId);
        if (!distribution) {
            return res.status(404).json({ error: 'Distribution not found' });
        }

        // Verify this shipment is for the logged-in retailer
        if (distribution.distributedToRetailer.retailerId !== retailerId) {
            return res.status(403).json({ error: 'This shipment is not assigned to you' });
        }

        // Check if already processed
        if (distribution.shippingDetails.status !== 'PENDING_RETAILER') {
            return res.status(400).json({
                error: `Shipment already ${distribution.shippingDetails.status}`
            });
        }

        // Update distribution status
        distribution.shippingDetails.status = 'AT_RETAILER';
        distribution.acceptedByRetailer = true;
        distribution.acceptedAt = new Date();
        await distribution.save();

        // Create retailer inventory entry
        const retailerInventory = new RetailerInventory({
            retailerId,
            productId: distribution.batchId,
            productName: distribution.productName,
            batchNumber: distribution.batchId,
            quantityInStock: distribution.quantity,
            quantitySold: 0,
            receivedFrom: {
                distributorId: distribution.distributorId,
                distributorName: distribution.receivedFromManufacturer?.manufacturerName || 'Unknown',
                receiveDate: new Date()
            },
            retailPrice: 0, // To be set by retailer
            status: 'in-stock'
        });
        await retailerInventory.save();

        // Call blockchain transfer stub
        const blockchainResult = await transferToRetailer(distributionId, retailerId);
        console.log('Blockchain transfer result:', blockchainResult);

        // Emit Socket.io notification to distributor
        const io = req.app.get('io');
        if (io) {
            io.emit('shipment_accepted', {
                distributionId,
                distributorId: distribution.distributorId,
                retailerId,
                productName: distribution.productName,
                quantity: distribution.quantity,
                timestamp: new Date()
            });
        }

        res.json({
            message: 'Shipment accepted successfully',
            distribution,
            retailerInventory,
            blockchainTx: blockchainResult.txHash
        });
    } catch (error) {
        console.error('Error accepting shipment:', error);
        res.status(500).json({ error: 'Failed to accept shipment' });
    }
});

/**
 * POST /api/retailer/reject
 * Reject an incoming shipment from distributor
 */
router.post('/reject', verifyToken, authorize(['RET']), async (req, res) => {
    try {
        const { distributionId, reason } = req.body;
        const retailerId = req.user.walletAddress;

        if (!distributionId) {
            return res.status(400).json({ error: 'distributionId is required' });
        }

        // Find the distribution
        const distribution = await DistributorInventory.findById(distributionId);
        if (!distribution) {
            return res.status(404).json({ error: 'Distribution not found' });
        }

        // Verify this shipment is for the logged-in retailer
        if (distribution.distributedToRetailer.retailerId !== retailerId) {
            return res.status(403).json({ error: 'This shipment is not assigned to you' });
        }

        // Check if already processed
        if (distribution.shippingDetails.status !== 'PENDING_RETAILER') {
            return res.status(400).json({
                error: `Shipment already ${distribution.shippingDetails.status}`
            });
        }

        // Update distribution status
        distribution.shippingDetails.status = 'REJECTED_BY_RETAILER';
        distribution.rejectionReason = reason || 'No reason provided';
        await distribution.save();

        // Emit Socket.io notification to distributor
        const io = req.app.get('io');
        if (io) {
            io.emit('shipment_rejected', {
                distributionId,
                distributorId: distribution.distributorId,
                retailerId,
                productName: distribution.productName,
                quantity: distribution.quantity,
                reason: reason || 'No reason provided',
                timestamp: new Date()
            });
        }

        res.json({
            message: 'Shipment rejected',
            distribution
        });
    } catch (error) {
        console.error('Error rejecting shipment:', error);
        res.status(500).json({ error: 'Failed to reject shipment' });
    }
});

/**
 * GET /api/retailer/inventory
 * View retailer's inventory (items with status AT_RETAILER)
 */
router.get('/inventory', verifyToken, authorize(['RET', 'ADMIN']), async (req, res) => {
    try {
        const retailerId = req.user.walletAddress;

        const inventory = await RetailerInventory.find({
            retailerId,
            status: 'in-stock'
        }).sort({ createdAt: -1 });

        res.json(inventory);
    } catch (error) {
        console.error('Error fetching retailer inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

/**
 * POST /api/retailer/mark-sold
 * Mark an item as sold (update quantities)
 */
router.post('/mark-sold', verifyToken, authorize(['RET']), async (req, res) => {
    try {
        const { batchId, quantitySold } = req.body;
        const retailerId = req.user.walletAddress;

        if (!batchId || !quantitySold || quantitySold <= 0) {
            return res.status(400).json({
                error: 'batchId and valid quantitySold are required'
            });
        }

        // Find the inventory item
        const inventoryItem = await RetailerInventory.findOne({
            retailerId,
            batchNumber: batchId,
            status: 'in-stock'
        });

        if (!inventoryItem) {
            return res.status(404).json({
                error: 'Inventory item not found or already sold'
            });
        }

        // Check if sufficient quantity available
        if (inventoryItem.quantityInStock < quantitySold) {
            return res.status(400).json({
                error: `Insufficient stock. Available: ${inventoryItem.quantityInStock}`
            });
        }

        // Update quantities
        inventoryItem.quantitySold += quantitySold;
        inventoryItem.quantityInStock -= quantitySold;

        // If all sold, update status
        if (inventoryItem.quantityInStock === 0) {
            inventoryItem.status = 'sold';
        }

        await inventoryItem.save();

        // Record sale on blockchain
        const blockchainResult = await recordSale(batchId, retailerId, quantitySold);
        console.log('Blockchain sale record:', blockchainResult);

        res.json({
            message: 'Sale recorded successfully',
            inventoryItem,
            blockchainTx: blockchainResult.txHash
        });
    } catch (error) {
        console.error('Error marking item as sold:', error);
        res.status(500).json({ error: 'Failed to mark item as sold' });
    }
});

export default router;
