import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.wrangler/**',
      '.pnpm-store/**',
      '.local/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@portfolio/*',
                'react',
                'react/*',
                'hono',
                'hono/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'cloudflare:*',
                'node:*',
                '@cloudflare/*',
              ],
              message: 'Domain must remain independent of UI, adapters, persistence and runtime.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket'],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@portfolio/domain',
            '@portfolio/database',
            '@portfolio/market-data',
            '@portfolio/importers',
          ],
        },
      ],
    },
  },
);
