import express from 'express';
import RawMaterial from '../models/rawMaterialModel.js';
import Manufacturing from '../models/manufacturingModel.js';
import DistributorInventory from '../models/distributorInventoryModel.js';
import RetailerInventory from '../models/RetailerInventory.js';
import { verifyToken } from '../middleware/roleAuth.js';

const router = express.Router();

/**
 * GET /api/provenance/:batchId
 * Get complete provenance (supply chain journey) for a product by batch ID
 */
router.get('/:batchId', verifyToken, async (req, res) => {
    try {
        const { batchId } = req.params;

        if (!batchId) {
            return res.status(400).json({ error: 'batchId is required' });
        }

        const provenance = {
            batchId,
            journey: [],
            participants: []
        };

        // 1. Find raw material
        const rawMaterial = await RawMaterial.findOne({ batchId });
        if (rawMaterial) {
            provenance.journey.push({
                stage: 'Raw Material Supply',
                timestamp: rawMaterial.timestamp,
                participant: {
                    id: rawMaterial.supplier,
                    name: rawMaterial.supplierName || 'Unknown Supplier',
                    role: 'Supplier'
                },
                details: {
                    materialName: rawMaterial.materialName,
                    quantity: rawMaterial.quantity,
                    origin: rawMaterial.origin,
                    certifications: rawMaterial.certifications
                }
            });
            provenance.participants.push({
                role: 'Supplier',
                id: rawMaterial.supplier,
                name: rawMaterial.supplierName || 'Unknown Supplier'
            });
        }

        // 2. Find manufacturing
        const manufacturing = await Manufacturing.findOne({
            $or: [
                { batchId },
                { rawMaterialBatchId: batchId }
            ]
        });
        if (manufacturing) {
            provenance.journey.push({
                stage: 'Manufacturing',
                timestamp: manufacturing.productionDate,
                participant: {
                    id: manufacturing.manufacturer,
                    name: manufacturing.manufacturerName || 'Unknown Manufacturer',
                    role: 'Manufacturer'
                },
                details: {
                    productName: manufacturing.productName,
                    quantity: manufacturing.quantity,
                    productionDate: manufacturing.productionDate,
                    expiryDate: manufacturing.expiryDate,
                    qualityCheck: manufacturing.qualityCheck
                }
            });
            provenance.participants.push({
                role: 'Manufacturer',
                id: manufacturing.manufacturer,
                name: manufacturing.manufacturerName || 'Unknown Manufacturer'
            });
        }

        // 3. Find distributor inventory
        const distributorInventory = await DistributorInventory.findOne({ batchId });
        if (distributorInventory) {
            provenance.journey.push({
                stage: 'Distribution',
                timestamp: distributorInventory.receivedFromManufacturer?.receiptDate || distributorInventory.createdAt,
                participant: {
                    id: distributorInventory.distributorId,
                    name: 'Distributor',
                    role: 'Distributor'
                },
                details: {
                    productName: distributorInventory.productName,
                    quantity: distributorInventory.quantity,
                    warehouseLocation: distributorInventory.warehouseLocation,
                    storageConditions: distributorInventory.storageConditions,
                    shippingStatus: distributorInventory.shippingDetails?.status
                }
            });
            provenance.participants.push({
                role: 'Distributor',
                id: distributorInventory.distributorId,
                name: 'Distributor'
            });

            // If distributed to retailer, add that info
            if (distributorInventory.distributedToRetailer?.retailerId) {
                provenance.journey.push({
                    stage: 'Distribution to Retailer',
                    timestamp: distributorInventory.distributedToRetailer.distributionDate,
                    participant: {
                        id: distributorInventory.distributedToRetailer.retailerId,
                        name: distributorInventory.distributedToRetailer.retailerName || 'Unknown Retailer',
                        role: 'Retailer'
                    },
                    details: {
                        accepted: distributorInventory.acceptedByRetailer,
                        acceptedAt: distributorInventory.acceptedAt,
                        status: distributorInventory.shippingDetails?.status
                    }
                });
                provenance.participants.push({
                    role: 'Retailer',
                    id: distributorInventory.distributedToRetailer.retailerId,
                    name: distributorInventory.distributedToRetailer.retailerName || 'Unknown Retailer'
                });
            }
        }

        // 4. Find retailer inventory
        const retailerInventory = await RetailerInventory.findOne({ batchNumber: batchId });
        if (retailerInventory) {
            provenance.journey.push({
                stage: 'Retail',
                timestamp: retailerInventory.receivedFrom?.receiveDate || retailerInventory.createdAt,
                participant: {
                    id: retailerInventory.retailerId,
                    name: 'Retailer',
                    role: 'Retailer'
                },
                details: {
                    productName: retailerInventory.productName,
                    quantityInStock: retailerInventory.quantityInStock,
                    quantitySold: retailerInventory.quantitySold,
                    retailPrice: retailerInventory.retailPrice,
                    status: retailerInventory.status
                }
            });
        }

        // Sort journey by timestamp
        provenance.journey.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Remove duplicate participants
        provenance.participants = provenance.participants.filter((participant, index, self) =>
            index === self.findIndex((p) => p.id === participant.id && p.role === participant.role)
        );

        if (provenance.journey.length === 0) {
            return res.status(404).json({
                error: 'No provenance data found for this batch ID'
            });
        }

        res.json(provenance);
    } catch (error) {
        console.error('Error fetching provenance:', error);
        res.status(500).json({ error: 'Failed to fetch provenance data' });
    }
});

export default router;
