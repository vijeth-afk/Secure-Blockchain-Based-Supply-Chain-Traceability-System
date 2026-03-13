import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['ADMIN','MAN', 'DIS', 'RET', 'SUP'],
        required: true
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true
    },
    // Optional public key to verify signatures from the user (hex or PEM depending on client)
    publicKey: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('User', userSchema);