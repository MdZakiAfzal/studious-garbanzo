require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // 1. Initialize Databases
        await connectDB();
        await connectRedis();

        // 2. Start Express Server
        app.listen(PORT, () => {
            console.log(`🚀 Server is listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error starting the server:', error);
        process.exit(1);
    }
};

startServer();