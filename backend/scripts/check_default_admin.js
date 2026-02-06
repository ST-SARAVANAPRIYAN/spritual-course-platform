/**
 * Diagnostic script to check default admin status in database
 * Run this to see which admin is set as default
 * 
 * Usage: node backend/scripts/check_default_admin.js
 */

require('dotenv').config({ path: './backend/.env' });
const mongoose = require('mongoose');
const { User } = require('../models/index');

async function checkDefaultAdmin() {
    try {
        // Connect to MongoDB
        const mongoURI = process.env.MONGODB_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/innerspark';
        
        if (!mongoURI || mongoURI === 'mongodb://localhost:27017/innerspark') {
            console.error('❌ ERROR: MONGODB_URL not found in environment variables');
            console.error('Please ensure backend/.env file exists with MONGODB_URL');
            process.exit(1);
        }
        
        await mongoose.connect(mongoURI);
        console.log('✓ Connected to MongoDB\n');

        // Find all admins
        const admins = await User.find({ role: 'Admin' })
            .select('name email studentID isDefaultAdmin active')
            .lean();

        if (admins.length === 0) {
            console.log('❌ No admin users found in database\n');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('📋 All Admin Users in Database:');
        console.log('================================\n');

        let defaultAdminCount = 0;
        
        admins.forEach((admin, index) => {
            const isDefault = admin.isDefaultAdmin === true;
            const isActive = admin.active !== false;
            
            if (isDefault) defaultAdminCount++;
            
            console.log(`${index + 1}. ${admin.name}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   ID: ${admin.studentID}`);
            console.log(`   Status: ${isActive ? '✅ Active' : '❌ Inactive'}`);
            console.log(`   Default Admin: ${isDefault ? '⭐ YES (DEFAULT)' : '❌ No'}`);
            console.log(`   isDefaultAdmin field: ${admin.isDefaultAdmin}`);
            console.log('');
        });

        console.log('================================');
        console.log(`Total Admins: ${admins.length}`);
        console.log(`Default Admins: ${defaultAdminCount}`);
        
        if (defaultAdminCount === 0) {
            console.log('\n⚠️  WARNING: No default admin is set!');
            console.log('Run: node backend/scripts/set_default_admin.js <email>');
        } else if (defaultAdminCount > 1) {
            console.log('\n⚠️  WARNING: Multiple default admins found! Only one should exist.');
            console.log('This may cause permission issues.');
        } else {
            const defaultAdmin = admins.find(a => a.isDefaultAdmin === true);
            console.log('\n✅ Default admin configuration is correct!');
            console.log(`Default Admin: ${defaultAdmin.name} (${defaultAdmin.email})`);
        }

        console.log('');
        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkDefaultAdmin();
