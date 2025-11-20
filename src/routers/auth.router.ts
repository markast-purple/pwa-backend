import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import { env } from '../config/env.js';
import { pool, type DbUser } from '../db/pool.js';
import generateTokens from '../utils/generateTokens.js';

type ErrorResponse = { error: string };

type LoginResponse =
  | { status: 'VERIFY_NEEDED'; message: string }
  | { status: 'SETUP_NEEDED'; qrCode: string; tempSecret: string };

type LoginRequestBody = { username?: string };
type VerifyRequestBody = { username?: string; token?: string; tempSecret?: string };

const authRouter = Router();

authRouter.post(
  '/login',
  async (
    req: Request<unknown, LoginResponse | ErrorResponse, LoginRequestBody>,
    res: Response<LoginResponse | ErrorResponse>,
  ) => {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    try {
      let result = await pool.query<DbUser>('SELECT * FROM users WHERE username = $1', [username]);

      if (result.rows.length === 0) {
        result = await pool.query<DbUser>(
          'INSERT INTO users (username) VALUES ($1) RETURNING *',
          [username],
        );
      }

      const user = result.rows[0];

      if (user.two_fa_secret) {
        return res.json({
          status: 'VERIFY_NEEDED',
          message: 'Enter the code from Google Authenticator',
        });
      }

      const tempSecret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(username, 'MyPWA App', tempSecret);
      const qrCodeUrl = await QRCode.toDataURL(otpauth);

      return res.json({
        status: 'SETUP_NEEDED',
        qrCode: qrCodeUrl,
        tempSecret,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Server error' });
    }
  },
);

authRouter.post(
  '/verify-2fa',
  async (
    req: Request<unknown, { accessToken: string } | ErrorResponse, VerifyRequestBody>,
    res: Response<{ accessToken: string } | ErrorResponse>,
  ) => {
    const { username, token, tempSecret } = req.body;

    if (!username || !token) {
      return res.status(400).json({ error: 'Username and token are required' });
    }

    try {
      const result = await pool.query<DbUser>('SELECT * FROM users WHERE username = $1', [
        username,
      ]);

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let secretToCheck: string | null = null;

      if (user.two_fa_secret) {
        secretToCheck = user.two_fa_secret;
      } else if (tempSecret) {
        secretToCheck = tempSecret;
      } else {
        return res.status(400).json({ error: 'Invalid auth logic' });
      }

      const isValid = authenticator.check(token, secretToCheck!);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid code' });
      }

      if (!user.two_fa_secret && tempSecret) {
        await pool.query('UPDATE users SET two_fa_secret = $1 WHERE id = $2', [tempSecret, user.id]);
      }

      const tokens = generateTokens(user);

      await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
        tokens.refreshToken,
        user.id,
      ]);

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });

      return res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Verification error' });
    }
  },
);

authRouter.get('/refresh', async (req: Request, res: Response<{ accessToken: string } | ErrorResponse>) => {
  const { refreshToken } = req.cookies as { refreshToken?: string };

  if (!refreshToken) {
    return res.sendStatus(401);
  }
  try {
    const dbResult = await pool.query<DbUser>('SELECT * FROM users WHERE refresh_token = $1', [
      refreshToken,
    ]);
    if (dbResult.rows.length === 0) {
      return res.sendStatus(403);
    }

    const user = dbResult.rows[0];

    jwt.verify(refreshToken, env.jwtSecret, (err) => {
      if (err) {
        return res.sendStatus(403);
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username },
        env.jwtSecret,
        { expiresIn: '15m' },
      );

      return res.json({ accessToken });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Refresh error' });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies as { refreshToken?: string };

  if (refreshToken) {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE refresh_token = $1', [refreshToken]);
  }

  res.clearCookie('refreshToken');
  res.sendStatus(200);
});

export default authRouter;

