import { Hono } from 'hono';
import { getHealth } from './get-health.js';

export const healthRoutes = new Hono().get('/health', (context) => context.json(getHealth()));
