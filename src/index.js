// src/index.js
import express from 'express';
import mongoose from 'mongoose';
import redis from 'redis';
import { createClient } from 'redis';
import bodyParser from 'body-parser';
import routes from './routes'; // Placeholder for route setup

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/file_upload', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Connect to Redis
const redisClient = createClient();
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Routes
app.use('/api', routes);

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
