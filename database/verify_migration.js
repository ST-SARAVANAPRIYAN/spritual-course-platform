const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { User } = require('../backend/models/index');

const verifyAllUsers = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 30000
        });
        console.log('✅ Connected.');

        const result = await User.updateMany(
            { isVerified: { $ne: true } },
            { $set: { isVerified: true } }
        );

        console.log(`✨ Success! Verified ${result.modifiedCount} users.`);
        console.log(`📊 Matched: ${result.matchedCount}`);

    } catch (err) {
        console.error('❌ Migration Failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

verifyAllUsers();
