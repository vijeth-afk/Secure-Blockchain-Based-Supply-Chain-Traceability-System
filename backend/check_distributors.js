import mongoose from 'mongoose';
import Participant from './models/participantModel.js';

const checkDistributors = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/supplychain", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("Connected to MongoDB");

        const distributors = await Participant.find({ role: 'DIS' });
        console.log(`Found ${distributors.length} distributors:`);
        distributors.forEach(d => console.log(`- ${d.name} (${d._id})`));

        const allParticipants = await Participant.find({});
        console.log(`Total participants: ${allParticipants.length}`);
        console.log("Roles found:", [...new Set(allParticipants.map(p => p.role))]);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        mongoose.disconnect();
    }
};

checkDistributors();
