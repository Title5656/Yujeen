import { Hono } from 'hono';
import { installErrorHandlers } from './middleware/errors.js';
import { healthRoutes } from './modules/health/routes.js';

export function createApp() {
  const app = new Hono();
  installErrorHandlers(app);
  app.route('/api', healthRoutes);
  return app;
}
