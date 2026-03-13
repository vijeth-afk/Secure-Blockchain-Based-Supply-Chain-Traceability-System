import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { verifySignature as verifySig } from '../utils/crypto.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Role hierarchy - ADMIN has superset permissions
const roleHierarchy = {
    ADMIN: ['ADMIN', 'MAN', 'DIS', 'RET', 'SUP'],
    MAN: ['MAN'],          // Manufacturer
    DIS: ['DIS'],          // Distributor
    RET: ['RET'],          // Retailer
    SUP: ['SUP']           // Supplier
};

// Middleware to verify JWT and extract user role
export const verifyToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        console.error('verifyToken error', err.message || err);
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// Middleware to check role authorization
export const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        const userRole = req.user.role;
        const hasPermission = allowedRoles.some(role => 
            roleHierarchy[userRole]?.includes(role)
        );

        if (!hasPermission) {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Middleware for simple ZKP-like verification using an externally provided verify function
export const verifyZKP = (operation) => {
    return async (req, res, next) => {
        const { proof, challenge, publicKey } = req.body.zkp || {};

        if (!proof || !challenge || !publicKey) {
            return res.status(400).json({ 
                message: 'ZKP verification failed: Missing parameters' 
            });
        }

        // This is a placeholder. Real ZKP verification should use snarkjs or a verifier contract.
        const hash = createHash('sha256');
        hash.update(publicKey + challenge);
        const expected = hash.digest('hex');

        if (expected !== proof) {
            return res.status(403).json({ message: 'ZKP verification failed: Invalid proof' });
        }

        next();
    };
};

// Generate challenge for ZKP/signature workflows
export const generateChallenge = () => {
    return createHash('sha256')
        .update(Date.now().toString())
        .digest('hex');
};

// small helper to verify ECDSA signatures for request payloads
export const verifySignature = ({ payload, signatureHex, publicKeyHex }) => {
    return verifySig({ payload, signatureHex, publicKeyHex });
};