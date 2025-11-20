import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import webpush from 'web-push';

import { env } from './config/env.js';
import authRouter from './routers/auth.router.js';
import subscriptionsRouter from './routers/subscriptions.router.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(bodyParser.json());

webpush.setVapidDetails('mailto:test@test.com', env.vapidPublicKey, env.vapidPrivateKey);

app.use(authRouter);
app.use('/auth', authRouter);
app.use(subscriptionsRouter);
app.use('/push', subscriptionsRouter);

app.listen(env.port, () => {
  console.log(`Server started on port ${env.port}`);
});

