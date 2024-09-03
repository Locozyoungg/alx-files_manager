// utils/redis.js
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    // Create a Redis client and handle errors
    this.client = createClient();

    // Log any errors from the Redis client
    this.client.on('error', (error) => {
      console.error(`Redis client error: ${error.message}`);
    });

    // Connect the client and handle connection success or failure
    this.client.connect()
      .then(() => console.log('Connected to Redis'))
      .catch((error) => console.error(`Redis connection error: ${error.message}`));
  }

  /**
   * Check if the Redis client connection is alive
   * @returns {boolean} True if Redis is connected, otherwise false
   */
  isAlive() {
    return this.client.isOpen;
  }

  /**
   * Get the value of a key from Redis
   * @param {string} key - The key to retrieve
   * @returns {Promise<string | null>} The value associated with the key or null if not found
   */
  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error(`Error getting value from Redis: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a value in Redis with an expiration time
   * @param {string} key - The key to set
   * @param {string | number} value - The value to store
   * @param {number} duration - Duration in seconds before the key expires
   * @returns {Promise<void>}
   */
  async set(key, value, duration) {
    try {
      await this.client.set(key, value);
      await this.client.expire(key, duration);
    } catch (error) {
      console.error(`Error setting value in Redis: ${error.message}`);
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   * @returns {Promise<void>}
   */
  async del(key) {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting value from Redis: ${error.message}`);
    }
  }
}

// Create and export an instance of RedisClient
const redisClient = new RedisClient();
export default redisClient;
