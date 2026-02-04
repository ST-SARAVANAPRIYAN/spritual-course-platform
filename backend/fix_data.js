const mongoose = require('mongoose');
const { Content, Module } = require('./models/index');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function fix() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/innerspark');
        console.log('Connected to DB');

        // 1. Delete legacy 'yoga' content
        const res = await Content.deleteMany({ title: /yoga/i });
        console.log('Deleted legacy content (yoga):', res.deletedCount);

        // Also delete any "video" category items if they are legacy tests (optional, but safer to stick to title)

        // 2. Update Draft Modules to Pending
        // This makes them visible to Admin for approval
        const res2 = await Module.updateMany(
            { approvalStatus: 'Draft' },
            { approvalStatus: 'Pending', isPublished: false }
        );
        console.log('Updated modules to Pending:', res2.modifiedCount);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log('Done');
        process.exit();
    }
}
fix();
