const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log('✅ Connected');
        console.log('📂 Database Name:', mongoose.connection.db.databaseName);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📚 Collections found:', collections.map(c => c.name));

        if (collections.find(c => c.name === 'modules')) {
            const count = await mongoose.connection.db.collection('modules').countDocuments();
            console.log(`🔢 Modules count (raw): ${count}`);

            const docs = await mongoose.connection.db.collection('modules').find({}).toArray();
            console.log(`📄 Module Docs:`, JSON.stringify(docs, null, 2));
        } else {
            console.log('❌ "modules" collection NOT found!');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}
debug();
