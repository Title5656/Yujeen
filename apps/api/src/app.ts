import { Hono } from 'hono';
import { installErrorHandlers } from './middleware/errors.js';
import { healthRoutes } from './modules/health/routes.js';
import { marketRoutes } from './modules/market-data/routes.js';
import type { MarketDependencies } from './modules/market-data/routes.js';
import type { InstallBindings } from './middleware/owner.js';

export function createApp(deps: MarketDependencies = {}) {
  const app = new Hono<{ Bindings: InstallBindings }>();
  installErrorHandlers(app);
  app.route('/api', healthRoutes);
  const { settings, market } = marketRoutes(deps);
  app.route('/api/integrations', settings);
  app.route('/api/market-data', market);
  return app;
}
