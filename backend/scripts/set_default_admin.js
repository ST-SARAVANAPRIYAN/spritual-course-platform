/**
 * Script to set the first default admin in the database
 * Run this script once to designate an existing admin as the default admin
 * 
 * Usage: node backend/scripts/set_default_admin.js <email_or_studentID>
 * Example: node backend/scripts/set_default_admin.js admin@innerspark.com
 */

require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const { User } = require('../models/index');

async function setDefaultAdmin() {
    try {
        // Get the identifier from command line arguments
        const identifier = process.argv[2];
        
        if (!identifier) {
            console.error('❌ Error: Please provide an admin email or student ID');
            console.log('Usage: node backend/scripts/set_default_admin.js <email_or_studentID>');
            console.log('Example: node backend/scripts/set_default_admin.js admin@innerspark.com');
            process.exit(1);
        }

        // Connect to MongoDB
        const mongoURI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/innerspark';
        
        if (!mongoURI || mongoURI === 'mongodb://localhost:27017/innerspark') {
            console.error('❌ ERROR: MONGODB_URL not found in environment variables');
            console.error('Please ensure backend/.env file exists with MONGODB_URL');
            process.exit(1);
        }
        
        await mongoose.connect(mongoURI);
        console.log('✓ Connected to MongoDB');

        // Find the admin user
        const admin = await User.findOne({
            $or: [
                { email: identifier },
                { studentID: identifier }
            ],
            role: 'Admin'
        });

        if (!admin) {
            console.error(`❌ Error: No admin user found with identifier "${identifier}"`);
            console.log('\nAvailable admins:');
            const admins = await User.find({ role: 'Admin' }).select('name email studentID isDefaultAdmin');
            if (admins.length === 0) {
                console.log('  No admin users found in the database.');
            } else {
                admins.forEach(a => {
                    console.log(`  - ${a.name} (${a.email}) [${a.studentID}] ${a.isDefaultAdmin ? '⭐ DEFAULT' : ''}`);
                });
            }
            await mongoose.connection.close();
            process.exit(1);
        }

        // Check if this admin is already the default admin
        if (admin.isDefaultAdmin) {
            console.log(`✓ ${admin.name} (${admin.email}) is already the default admin`);
            await mongoose.connection.close();
            return;
        }

        // Remove default status from all other admins
        await User.updateMany(
            { role: 'Admin', isDefaultAdmin: true },
            { $set: { isDefaultAdmin: false } }
        );
        console.log('✓ Removed default admin status from other admins');

        // Set this admin as default
        admin.isDefaultAdmin = true;
        await admin.save();
        
        console.log('\n✅ Success! Default admin has been set:');
        console.log(`   Name: ${admin.name}`);
        console.log(`   Email: ${admin.email}`);
        console.log(`   ID: ${admin.studentID}`);
        console.log('\n⚠️  IMPORTANT: You must log out and log back in for changes to take effect!\n');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setDefaultAdmin();
