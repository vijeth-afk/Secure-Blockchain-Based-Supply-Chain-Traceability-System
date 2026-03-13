import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({
  role: { type: String, required: true },
  name: { type: String, required: true },
  place: { type: String, required: true },
  address: { type: String, required: true },
  blockchainTx: { type: String },
  // Raw Material Supplier specific fields
  materials: { type: [String], default: [] },
  // Manufacturer specific fields
  availableProducts: { type: [String], default: [] },
  // Distributor specific fields
  canDeliverFragile: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Participant", participantSchema);
