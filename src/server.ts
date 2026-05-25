import 'dotenv/config';
import { app } from './app';
import { env } from './config/env';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const startServer = (): void => {
  app.listen(env.port, () => {
  console.log(`Server running on http://127.0.0.1:${env.port}`);
});
};

startServer();