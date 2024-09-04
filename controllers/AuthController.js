import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  static async getConnect(req, res) {
    // Extract the Authorization header
    const authHeader = req.headers.authorization || '';
    const base64Credentials = authHeader.split(' ')[1] || '';
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [email, password] = credentials.split(':');

    // Validate the credentials
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Hash the password and find the user in the database
    const hashedPassword = sha1(password);
    const user = await (await dbClient.usersCollection()).findOne({ email, password: hashedPassword });

    // If no user is found, return an error
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a new token and store it in Redis with a 24-hour expiration
    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);

    // Return the token to the client
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    // Retrieve the token from the X-Token header
    const token = req.headers['x-token'];

    // Delete the token from Redis to log the user out
    await redisClient.del(`auth_${token}`);

    // Return a 204 No Content response
    return res.status(204).send();
  }
}