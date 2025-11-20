import { Pool } from 'pg';
import {env} from "../config/env.js";

export const pool = new Pool({
  connectionString: env.databaseURL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export type DbUser = {
  id: number;
  username: string;
  two_fa_secret: string | null;
  refresh_token: string | null;
};

