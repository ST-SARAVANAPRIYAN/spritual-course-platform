const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const { Module } = require('../models/index');

async function migrateModules() {
    try {
        console.log('🔄 Starting module content type migration...');
        console.log('📡 Connecting to MongoDB...');

        // Connect to MongoDB with increased timeout
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000,
        });

        console.log('✅ Connected to MongoDB');

        // Find all modules without contentType
        const modulesWithoutType = await Module.find({
            $or: [
                { contentType: { $exists: false } },
                { contentType: null }
            ]
        });

        console.log(`📊 Found ${modulesWithoutType.length} modules to migrate`);

        if (modulesWithoutType.length === 0) {
            console.log('✅ No modules need migration. All modules already have contentType.');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Update all modules to have contentType = 'rich-content'
        const result = await Module.updateMany(
            {
                $or: [
                    { contentType: { $exists: false } },
                    { contentType: null }
                ]
            },
            {
                $set: { contentType: 'rich-content' }
            }
        );

        console.log(`✅ Migration complete: ${result.modifiedCount} modules updated`);
        console.log('All existing modules now have contentType: "rich-content"');

        await mongoose.connection.close();
        console.log('📡 Database connection closed');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

migrateModules();
