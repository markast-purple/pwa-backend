import { Router, type Request, type Response } from 'express';
import webpush, { type PushSubscription } from 'web-push';
import authenticateToken from '../middlewares/authenticate.middleware.js';
import { pool } from '../db/pool.js';

const subscriptionsRouter = Router();
const DEFAULT_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/5968/5968342.png';

type DeliveryParams = {
  userId: number;
  username: string;
  body: string;
};

const sendNotificationForUser = async ({ userId, username, body }: DeliveryParams) => {
  const result = await pool.query<{ sub_data: PushSubscription }>(
    'SELECT sub_data FROM subscriptions WHERE user_id = $1',
    [userId],
  );

  if (result.rows.length === 0) {
    return { hasSubscriptions: false };
  }

  const payload = JSON.stringify({
    title: `Hello, ${username}!`,
    body,
    icon: DEFAULT_ICON_URL,
  });

  const pushPromises = result.rows.map((row) => webpush.sendNotification(row.sub_data, payload));
  await Promise.allSettled(pushPromises);

  return { hasSubscriptions: true };
};

const scheduleDelayedNotification = ({ userId, username, body, delayMs }: DeliveryParams & { delayMs: number }) => {
  setTimeout(async () => {
    try {
      await sendNotificationForUser({ userId, username, body });
    } catch (error) {
      console.error('Delayed notification failed', error);
    }
  }, delayMs);
};

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
    const { hasSubscriptions } = await sendNotificationForUser({
      userId: req.user.id,
      username: req.user.username,
      body: 'Notification from Backend',
    });

    if (!hasSubscriptions) {
      return res.status(400).json({ error: 'No subscriptions' });
    }

    res.status(200).json({ message: 'Notifications sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Delivery error' });
  }
});

subscriptionsRouter.post('/send-delayed-notification', authenticateToken, (req: Request, res: Response) => {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const { delayMs } = (req.body ?? {}) as { delayMs?: number };
  const sanitizedDelay = typeof delayMs === 'number' && delayMs > 0 ? delayMs : 30000;

  scheduleDelayedNotification({
    userId: req.user.id,
    username: req.user.username,
    body: 'Delayed notification from Backend',
    delayMs: sanitizedDelay,
  });

  res.status(202).json({ message: 'Notification scheduled', delayMs: sanitizedDelay });
});

export default subscriptionsRouter;

