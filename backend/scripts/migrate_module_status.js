const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const { Module } = require('../models/index');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 50000,
            socketTimeoutMS: 50000,
            connectTimeoutMS: 50000
        });
        console.log('✅ DB Connected');

        // Find modules with status 'Published'
        const publishedModules = await Module.find({ status: 'Published' });
        console.log(`Found ${publishedModules.length} modules with status 'Published'.`);

        if (publishedModules.length > 0) {
            const res = await Module.updateMany(
                { status: 'Published' },
                { $set: { status: 'Approved' } }
            );
            console.log(`✅ Updated ${res.modifiedCount} modules to 'Approved'.`);
        } else {
            console.log('No migration needed.');
        }

        process.exit();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
};

migrate();
