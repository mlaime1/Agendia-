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
  adminKey: process.env.ADMIN_KEY,
  supabaseStudioUrl: process.env.SUPABASE_STUDIO_URL ?? 'http://127.0.0.1:54323',
  mail: {
    from: process.env.MAIL_FROM ?? 'Agendia <no-reply@agendia.local>',
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  passwordRecovery: {
    cooldownMinutes: Number(process.env.PASSWORD_RECOVERY_COOLDOWN_MINUTES ?? 10),
    ipRequestsPerHour: Number(process.env.PASSWORD_RECOVERY_IP_REQUESTS_PER_HOUR ?? 20),
    temporaryPasswordLength: 12,
  },
} as const;