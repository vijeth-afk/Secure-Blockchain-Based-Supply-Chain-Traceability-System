import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
    const { name, email, password, role, walletAddress, publicKey } = req.body;
        
        console.log('Registration attempt:', { name, email, role, walletAddress });

        // Input validation
        if (!name || !email || !password || !role || !walletAddress) {
            console.log('Missing required fields:', { name: !!name, email: !!email, password: !!password, role: !!role, walletAddress: !!walletAddress });
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if user already exists by email or wallet address
        let existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() }, 
                { walletAddress: walletAddress.toLowerCase() }
            ] 
        });

        if (existingUser) {
            console.log('User already exists:', {
                existingEmail: existingUser.email === email.toLowerCase(),
                existingWallet: existingUser.walletAddress.toLowerCase() === walletAddress.toLowerCase()
            });
            return res.status(400).json({
                success: false,
                message: existingUser.email === email.toLowerCase() 
                    ? 'Email already registered' 
                    : 'Wallet address already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role,
            walletAddress: walletAddress.toLowerCase(),
            publicKey: publicKey || '',
            createdAt: new Date(),
            lastLogin: null,
            failedLoginAttempts: 0
        });

        await user.save();
        console.log('User registered successfully:', { userId: user._id, role: user.role });

        res.status(201).json({
            success: true,
            message: 'User registered successfully'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in registration'
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password, walletAddress } = req.body;
        console.log('Login attempt:', { email, walletAddress });

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found:', email);
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        console.log('User found:', { 
            userWallet: user.walletAddress, 
            providedWallet: walletAddress,
            userRole: user.role
        });

        // Verify wallet address
        if (user.walletAddress && user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            console.log('Wallet mismatch:', {
                stored: user.walletAddress,
                provided: walletAddress
            });
            return res.status(400).json({
                success: false,
                message: 'Wallet address mismatch'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password check:', { isMatch });
        
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                role: user.role,
                email: user.email,
                walletAddress: user.walletAddress 
            },
            process.env.JWT_SECRET || 'your_jwt_secret', 
            { expiresIn: '24h' }
        );

        console.log('Login successful:', {
            userId: user._id,
            role: user.role,
            name: user.name
        });

        res.json({
            success: true,
            token,
            role: user.role,
            name: user.name,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                name: user.name,
                walletAddress: user.walletAddress
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in login'
        });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.header('x-auth-token');
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token, authorization denied'
            });
        }

        const decoded = jwt.verify(token, 'your_jwt_secret');
        const user = await User.findById(decoded.userId).select('-password');
        
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Token is not valid'
        });
    }
});

export default router;