import jwt from 'jsonwebtoken';
import { env, type AuthenticatedUser } from '../config/env.js';

export type TokensBundle = {
  accessToken: string;
  refreshToken: string;
};

const generateTokens = (user: AuthenticatedUser): TokensBundle => {
  const payload = { id: user.id, username: user.username };

  const accessToken = jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

export default generateTokens;

