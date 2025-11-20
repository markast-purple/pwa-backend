import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.sendStatus(401);
    return;
  }

  jwt.verify(token, env.jwtSecret, (err, decoded) => {
    if (err || !decoded) {
      res.sendStatus(403);
      return;
    }

    req.user = decoded as Express.Request['user'];
    next();
  });
};

export default authenticateToken;

