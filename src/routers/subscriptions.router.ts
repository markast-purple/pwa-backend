import { Router, type Request, type Response } from 'express';
import webpush, { type PushSubscription } from 'web-push';
import authenticateToken from '../middlewares/authenticate.middleware.js';
import { pool } from '../db/pool.js';

const subscriptionsRouter = Router();

subscriptionsRouter.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const subscription = req.body as PushSubscription;
  const userId = req.user.id;

  try {
    const query = `
      INSERT INTO subscriptions (user_id, sub_data) 
      VALUES ($1, $2)
      ON CONFLICT ((sub_data->>'endpoint')) 
      DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        created_at = CURRENT_TIMESTAMP;
    `;

    await pool.query(query, [userId, subscription]);
    res.status(201).json({ message: 'Device ownership transferred' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'DB Error' });
  }
});

subscriptionsRouter.post('/send-notification', authenticateToken, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  try {
    const result = await pool.query<{ sub_data: PushSubscription }>(
      'SELECT sub_data FROM subscriptions WHERE user_id = $1',
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No subscriptions' });
    }

    const payload = JSON.stringify({
      title: `Hello, ${req.user.username}!`,
      body: 'Notification from Backend',
      icon: 'https://cdn-icons-png.flaticon.com/512/5968/5968342.png',
    });

    const pushPromises = result.rows.map((row) => webpush.sendNotification(row.sub_data, payload));

    await Promise.allSettled(pushPromises);

    res.status(200).json({ message: 'Notifications sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Delivery error' });
  }
});

export default subscriptionsRouter;

