import dotenv from 'dotenv';

dotenv.config();

const portValue = process.env.PORT ?? '3000';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(portValue),
  databaseUrl: process.env.DATABASE_URL,
} as const;