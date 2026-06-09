import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './middlewares/logger';
import { swaggerSpec } from './docs/swagger';
import './utils/bigint';

export const app = express();
app.use(cors());
app.use(express.json());
app.use(logger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Agendia API',
}));

app.use(routes);
app.use((_req, res) => { res.status(404).json({ success: false, message: 'Route not found' }); });
app.use(errorHandler);