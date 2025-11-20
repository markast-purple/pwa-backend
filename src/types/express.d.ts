import type { JwtPayload } from 'jsonwebtoken';
import type { AuthenticatedUser } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & AuthenticatedUser;
    }
  }
}

export {};

