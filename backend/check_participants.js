const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
    role: { type: String, required: true },
    name: { type: String, required: true },
    place: { type: String, required: true },
    address: { type: String, required: true },
    blockchainTx: { type: String },
    materials: { type: [String], default: [] },
    availableProducts: { type: [String], default: [] },
    canDeliverFragile: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Participant = mongoose.model("Participant", participantSchema);

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/supplychain", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("✅ MongoDB connected successfully");

        const participants = await Participant.find({});
        console.log("Total participants:", participants.length);

        console.log("\nManufacturers:");
        const manufacturers = participants.filter(p => p.role === "MAN");
        manufacturers.forEach(p => console.log(`- Name: ${p.name}, Address: ${p.address}, Role: ${p.role}`));

        console.log("\nRetailers:");
        const retailers = participants.filter(p => p.role === "RET");
        retailers.forEach(p => console.log(`- Name: ${p.name}, Address: ${p.address}, Role: ${p.role}`));

        console.log("\nAll Participants:");
        participants.forEach(p => console.log(`- Name: ${p.name}, Address: ${p.address}, Role: ${p.role}`));

        mongoose.disconnect();
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err);
    }
};

connectDB();
