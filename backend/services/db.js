// backend/services/db.js

const mongoose = require('mongoose');
require('dotenv').config(); // loads .env file

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`[DATABASE ERROR] Connection failed: ${error.message}`);
        process.exit(1); // stop server if it can't connect
    }
};

module.exports = { connectDB };