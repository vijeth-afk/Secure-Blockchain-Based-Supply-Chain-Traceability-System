import express from 'express';
import RetailerInventory from '../models/RetailerInventory.js';

const router = express.Router();

// Get all inventory items
router.get('/', async (req, res) => {
    try {
        const inventory = await RetailerInventory.find();
        res.json(inventory);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add new inventory item
router.post('/', async (req, res) => {
    const inventory = new RetailerInventory({
        retailerId: req.body.retailerId,
        productId: req.body.productId,
        productName: req.body.productName,
        batchNumber: req.body.batchNumber,
        quantitySold: req.body.quantitySold,
        quantityInStock: req.body.quantityInStock,
        receivedFrom: req.body.receivedFrom,
        retailPrice: req.body.retailPrice,
        status: req.body.status
    });

    try {
        const newInventory = await inventory.save();
        res.status(201).json(newInventory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update inventory item
router.patch('/:id', async (req, res) => {
    try {
        const inventory = await RetailerInventory.findById(req.params.id);
        if (inventory == null) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }

        if (req.body.retailerId != null) {
            inventory.retailerId = req.body.retailerId;
        }
        if (req.body.productId != null) {
            inventory.productId = req.body.productId;
        }
        if (req.body.productName != null) {
            inventory.productName = req.body.productName;
        }
        if (req.body.batchNumber != null) {
            inventory.batchNumber = req.body.batchNumber;
        }
        if (req.body.quantitySold != null) {
            inventory.quantitySold = req.body.quantitySold;
        }
        if (req.body.quantityInStock != null) {
            inventory.quantityInStock = req.body.quantityInStock;
        }
        if (req.body.receivedFrom != null) {
            inventory.receivedFrom = req.body.receivedFrom;
        }
        if (req.body.retailPrice != null) {
            inventory.retailPrice = req.body.retailPrice;
        }
        if (req.body.status != null) {
            inventory.status = req.body.status;
        }

        const updatedInventory = await inventory.save();
        res.json(updatedInventory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
    try {
        const inventory = await RetailerInventory.findById(req.params.id);
        if (inventory == null) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        await inventory.remove();
        res.json({ message: 'Inventory item deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;