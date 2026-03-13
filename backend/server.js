import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import participantRoutes from "./routes/participantRoutes.js";
import rawMaterialRoutes from "./routes/rawMaterialRoutes.js";
import manufacturingRoutes from "./routes/manufacturingRoutes.js";
import distributorInventoryRoutes from "./routes/distributorInventoryRoutes.js";
import retailerInventoryRoutes from "./routes/retailerInventoryRoutes.js";
import retailerOrderRoutes from "./routes/retailerOrderRoutes.js";
import distributionRequestRoutes from "./routes/distributionRequestRoutes.js";
import zkpRoutes from "./routes/zkpRoutes.js";
import anomalyRoutes from "./routes/anomalyRoutes.js";
import eventRoutes from "./routes/events.js";
import retailerShipmentRoutes from "./routes/retailerShipmentRoutes.js";
import provenanceRoutes from "./routes/provenanceRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import anomalyDetector from "./services/anomalyDetector.js";

const app = express();
const httpServer = createServer(app);

// ✅ Socket.IO Configuration
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Make io accessible to routes
app.set('io', io);

app.use(express.json());
app.use(cors());

// ✅ Mongoose Configuration
mongoose.set('strictQuery', false);

// ✅ MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/supplychain", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected successfully");
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
        // Wait for 5 seconds and try again
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/participants", participantRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
// Backwards-compatible route without hyphen (client expects `/api/rawmaterials`)
app.use("/api/rawmaterials", rawMaterialRoutes);
app.use("/api/manufacturing", manufacturingRoutes);
app.use("/api/distributor-inventory", distributorInventoryRoutes);
app.use("/api/retailer-inventory", retailerInventoryRoutes);
app.use("/api/retailer-orders", retailerOrderRoutes);
app.use("/api/distribution-requests", distributionRequestRoutes);
app.use("/api/zkp", zkpRoutes);
app.use("/api/anomalies", anomalyRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/users", userRoutes);
app.use("/api/retailer", retailerShipmentRoutes);
app.use("/api/provenance", provenanceRoutes);
// Debug endpoints (local dev only)
app.use("/api/debug", debugRoutes);

// ✅ Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
    });
});

// ✅ Initialize anomaly detector
anomalyDetector.initialize().then(() => {
    console.log('✅ Anomaly detector initialized');
}).catch(err => {
    console.error('❌ Failed to initialize anomaly detector:', err);
});

// ✅ Periodic anomaly scan (every 6 hours)
setInterval(async () => {
    console.log('🔍 Running scheduled anomaly scan...');
    try {
        await anomalyDetector.scanAll();
    } catch (error) {
        console.error('❌ Scheduled anomaly scan failed:', error);
    }
}, 6 * 60 * 60 * 1000); // 6 hours

// ✅ Start Server
const PORT = 5002;  // Changed port to 5002
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
