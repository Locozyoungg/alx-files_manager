// utils/db.js
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class DBClient {
  constructor() {
    // Set MongoDB connection details from environment variables or defaults
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';

    // Construct the MongoDB URI
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Connect to the MongoDB client and select the database
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        console.log('Connected to MongoDB');
      })
      .catch((error) => {
        console.error(`MongoDB connection error: ${error.message}`);
      });
  }

  /**
   * Check if the MongoDB client connection is alive
   * @returns {boolean} True if the MongoDB client is connected, otherwise false
   */
  isAlive() {
    return this.client && this.client.topology && this.client.topology.isConnected();
  }

  /**
   * Get the number of users in the 'users' collection
   * @returns {Promise<number>} The count of user documents
   */
  async nbUsers() {
    try {
      return await this.db.collection('users').countDocuments();
    } catch (error) {
      console.error(`Error counting users: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get the number of files in the 'files' collection
   * @returns {Promise<number>} The count of file documents
   */
  async nbFiles() {
    try {
      return await this.db.collection('files').countDocuments();
    } catch (error) {
      console.error(`Error counting files: ${error.message}`);
      return 0;
    }
  }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
export default dbClient;
