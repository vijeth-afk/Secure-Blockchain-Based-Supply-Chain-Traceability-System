import express from 'express';
import { verifyToken, authorize, verifyZKP, generateChallenge } from '../middleware/roleAuth.js';

const router = express.Router();

// Route to get a challenge for proving
router.get('/challenge', verifyToken, (req, res) => {
    const challenge = generateChallenge();
    res.json({ challenge });
});

// Endpoint to verify a ZKP proof payload. This is scaffolding — a real integration
// will require compiled circuits and verification keys uploaded to the server.
router.post('/verify', verifyToken, authorize(['ADMIN','MAN','DIS']), async (req, res) => {
    try {
        const { proof, publicSignals, vk } = req.body;

        if (!proof || !publicSignals) {
            return res.status(400).json({ message: 'Missing proof or publicSignals' });
        }

        // If verification key provided, try to dynamically import snarkjs and verify
        if (vk) {
            try {
                const snarkjs = await import('snarkjs');
                if (snarkjs && snarkjs.groth16) {
                    const resOk = await snarkjs.groth16.verify(vk, publicSignals, proof);
                    if (resOk) return res.json({ verified: true });
                    return res.status(400).json({ verified: false, message: 'Proof verification failed' });
                }
            } catch (err) {
                console.warn('snarkjs unavailable or verification error:', err && err.message ? err.message : err);
                // fallthrough to fallback behavior below
            }
        }

        // Fallback: a simple proof format check (NOT SECURE) — returns 200 to allow integration work
        return res.json({ verified: true, message: 'Proof accepted by fallback (not cryptographically verified)' });
    } catch (err) {
        console.error('ZKP verify route error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
