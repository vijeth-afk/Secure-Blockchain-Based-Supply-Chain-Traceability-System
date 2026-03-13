import { createHash } from 'crypto';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

// Hash a payload deterministically
export function hashPayload(payload) {
    const json = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHash('sha256').update(json).digest('hex');
}

// Verify an ECDSA signature (hex signature) against a public key (hex or PEM-like)
// signature expected as hex string (r + s) or der hex; publicKey should be uncompressed hex (04...)
export function verifySignature({ payload, signatureHex, publicKeyHex }) {
    try {
        const msgHash = hashPayload(payload);
        // if publicKeyHex begins with 0x, strip
        const pk = publicKeyHex?.replace(/^0x/, '') || '';
        if (!pk) return false;

        const key = ec.keyFromPublic(pk, 'hex');

        // signature can be DER or r/s concatenated. Try DER first
        let verified = false;
        try {
            verified = key.verify(msgHash, signatureHex);
        } catch (e) {
            // try parsing as r/s
            const r = signatureHex.slice(0, 64);
            const s = signatureHex.slice(64, 128);
            verified = key.verify(msgHash, { r, s });
        }

        return verified;
    } catch (err) {
        console.error('verifySignature error', err);
        return false;
    }
}

// Simple helper to generate a challenge (for ZKP or signature challenges)
export function generateChallenge() {
    return createHash('sha256').update(Date.now().toString()).digest('hex');
}

export default { hashPayload, verifySignature, generateChallenge };
