const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function forceUpdate() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected to:', mongoose.connection.db.databaseName);

        // 1. Inspect Content
        const contentCollection = mongoose.connection.db.collection('contents');
        const contents = await contentCollection.find({}).toArray();
        console.log(`\n🔍 Found ${contents.length} Content items:`);
        contents.forEach(c => console.log(`   - [${c._id}] "${c.title}" (Status: ${c.approvalStatus})`));

        // Delete 'yoga' if found
        const yoga = contents.find(c => c.title && c.title.toLowerCase().includes('yoga'));
        if (yoga) {
            console.log(`\n🗑️ Deleting legacy content: ${yoga.title} (${yoga._id})`);
            await contentCollection.deleteOne({ _id: yoga._id });
            console.log('   ✅ Deleted');
        } else {
            console.log('\n⚠️ Legacy content "yoga" not found in DB.');
        }

        // 2. Force Update Modules
        const moduleCollection = mongoose.connection.db.collection('modules');
        const modules = await moduleCollection.find({}).toArray();
        console.log(`\n📦 Found ${modules.length} Modules:`);

        let updatedCount = 0;
        for (const m of modules) {
            console.log(`   - Processing [${m._id}] "${m.title}"...`);
            // Force update
            await moduleCollection.updateOne(
                { _id: m._id },
                {
                    $set: {
                        approvalStatus: 'Pending',
                        isPublished: false,
                        updatedAt: new Date()
                    }
                }
            );
            updatedCount++;
        }
        console.log(`\n✅ Forced update on ${updatedCount} modules to Pending/Unpublished.`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}
forceUpdate();
