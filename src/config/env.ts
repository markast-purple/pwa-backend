import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 5000),
  vapidPublicKey: requireEnv('VAPID_PUBLIC_KEY'),
  vapidPrivateKey: requireEnv('VAPID_PRIVATE_KEY'),
  jwtSecret: requireEnv('JWT_SECRET'),
  databaseURL: requireEnv('DATABASE_URL')
};

export type AuthenticatedUser = {
  id: number;
  username: string;
};

