import cors from 'cors';
import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './middlewares/logger';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(logger);
app.use(routes);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);