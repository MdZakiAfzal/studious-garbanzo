const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Redis connected successfully'));

const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error.message);
        process.exit(1);
    }
};

module.exports = { redisClient, connectRedis };