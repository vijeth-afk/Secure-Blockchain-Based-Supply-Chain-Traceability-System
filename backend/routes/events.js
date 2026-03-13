import express from 'express';
import eventBus from '../utils/eventBus.js';

const router = express.Router();

// Server-Sent Events endpoint for real-time notifications
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const sendEvent = (name, data) => {
        res.write(`event: ${name}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onDistCreated = (payload) => sendEvent('distributor_inventory_created', payload);
    const onDistributionCreated = (payload) => sendEvent('distribution_created', payload);
    const onDistributionApproved = (payload) => sendEvent('distribution_approved', payload);
    const onDistributionRejected = (payload) => sendEvent('distribution_rejected', payload);

    eventBus.on('distributor_inventory_created', onDistCreated);
    eventBus.on('distribution_created', onDistributionCreated);
    eventBus.on('distribution_approved', onDistributionApproved);
    eventBus.on('distribution_rejected', onDistributionRejected);

    // send a ping every 20s to keep connection alive
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        eventBus.removeListener('distributor_inventory_created', onDistCreated);
        eventBus.removeListener('distribution_created', onDistributionCreated);
        eventBus.removeListener('distribution_approved', onDistributionApproved);
        eventBus.removeListener('distribution_rejected', onDistributionRejected);
    });
});

export default router;
