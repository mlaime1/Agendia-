import 'dotenv/config';
import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { startSummaryScheduler } from './modules/summaries/scheduler';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const logDatabaseStatus = async (): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database status: up');
  } catch (error) {
    console.error('Database status: down');
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
};

const startServer = async (): Promise<void> => {
  app.listen(env.port, () => {
    console.log(`Server running on http://127.0.0.1:${env.port}`);
    console.log(`API docs on http://127.0.0.1:${env.port}/api-docs`);
    console.log(`Supabase Studio on ${env.supabaseStudioUrl}`);
  });

  await logDatabaseStatus();
};

startServer();
startSummaryScheduler();