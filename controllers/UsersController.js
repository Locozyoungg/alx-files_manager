import sha1 from 'sha1';
import dbClient from '../utils/db';

export default class UsersController {
  static async postNew(req, res) {
    try {
      const email = req.body ? req.body.email : null;
      const password = req.body ? req.body.password : null;

      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      const user = await (await dbClient.usersCollection()).findOne({ email });

      if (user) {
        return res.status(400).json({ error: 'Already exist' });
      }

      const insertionInfo = await (await dbClient.usersCollection())
        .insertOne({ email, password: sha1(password) });
      const userId = insertionInfo.insertedId.toString();

      // Here, you would handle the email sending or any other background task without using a queue.
      // This is just an example of how you might log that the user was added.

      console.log(`New user created with ID: ${userId}. Email sending can be handled here.`);

      return res.status(201).json({ email, id: userId });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getMe(req, res) {
    try {
      const { user } = req;
      return res.status(200).json({ email: user.email, id: user._id.toString() });
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}