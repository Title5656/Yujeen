import type * as MainModule from '../src/index.js';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
    }
    interface GlobalProps {
      mainModule: typeof MainModule;
    }
  }
}
