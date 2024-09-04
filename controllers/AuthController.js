import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const { user } = req;  // Assumes user is authenticated and available
    const token = uuidv4();

    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);  // Store token with expiration
    res.status(200).json({ token });  // Respond with the token
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];  // Get token from header

    await redisClient.del(`auth_${token}`);  // Delete token from Redis
    res.status(204).send();  // Respond with no content
  }
}