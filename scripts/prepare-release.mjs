import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { log } from 'node:console';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { env } from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { TextDecoder } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicName = 'Yujeen';
const publicEmail = 'maintainers@yujeen.invalid';
const gitEnv = {
  ...Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: publicName,
  GIT_AUTHOR_EMAIL: publicEmail,
  GIT_COMMITTER_NAME: publicName,
  GIT_COMMITTER_EMAIL: publicEmail,
};
const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', windowsHide: true });
const candidates = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split(
  '\0',
);
const rootFiles = new Set([
  '.gitattributes',
  '.editorconfig',
  '.gitignore',
  '.node-version',
  '.prettierignore',
  '.prettierrc.json',
  'eslint.config.js',
  'LICENSE',
  'README.md',
  'package.json',
  'playwright.config.ts',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.tools.json',
  'vitest.config.ts',
  '.github/workflows/ci.yml',
]);
const pathAllowed =
  /^(apps\/(api|web)|packages\/(contracts|database|domain|importers|market-data)|scripts|tests)\/[^/].*\.(tsx?|mjs|js|jsonc?|css|html|sql|txt)$/;
const privatePath =
  /(^|\/)(?:\.|node_modules\/|dist\/|private-documents\/|backups\/)|\.local\.|\.secret\./i;
const secretMarkers =
  /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:PK[A-Z0-9]{18,}|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b)/;
const machinePath = /[A-Z]:[\\/]+Users[\\/]+[^\\/\s]+/i;
const identities = git(root, 'log', '--all', '--format=%ae%n%ce')
  .split(/\r?\n/)
  .filter((email) => email.length > 5 && !/noreply|\.invalid$/i.test(email));
const ownerEmail = env['RELEASE_OWNER_EMAIL']?.trim().toLowerCase();
if (ownerEmail) identities.push(ownerEmail);
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const files = new Map();
for (const path of new Set(candidates.filter(Boolean))) {
  if (path.split('/').some((segment) => segment === '..')) throw new Error('Invalid release path');
  const src = resolve(root, path);
  if (!existsSync(src)) continue;
  if (!rootFiles.has(path) && (!pathAllowed.test(path) || privatePath.test(path))) {
    throw new Error('Review file outside the release allowlist: ' + path);
  }
  if (!lstatSync(src).isFile()) throw new Error('Release entry must be a regular file: ' + path);
  const body = decoder.decode(readFileSync(src)).replaceAll('\r\n', '\n');
  const lower = body.toLowerCase();
  const content = path === 'pnpm-lock.yaml' ? body.replace(/integrity: \S+/g, '') : body;
  if (
    secretMarkers.test(content) ||
    machinePath.test(content) ||
    identities.some((email) => lower.includes(email.toLowerCase()))
  ) {
    throw new Error('Review possible private content in: ' + path);
  }
  files.set(path, Buffer.from(body, 'utf8'));
}
for (const expected of rootFiles) {
  if (!files.has(expected)) throw new Error('Missing release file: ' + expected);
}
const output = join(root, '.local', 'release', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(dirname(output), { recursive: true });
mkdirSync(output);
for (const [path, bytes] of files) {
  const dest = join(output, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes, { flag: 'wx' });
}
git(output, 'init', '--initial-branch=main', '--object-format=sha1', '--template=');
git(output, '-c', 'core.autocrlf=false', 'add', '--all');
const staged = git(output, 'ls-files', '--stage', '-z').split('\0').filter(Boolean);
if (staged.length !== files.size) {
  throw new Error('Release index differs from the audited file list');
}
for (const entry of staged) {
  const tab = entry.indexOf('\t');
  const bytes = files.get(entry.slice(tab + 1));
  if (!bytes) throw new Error('Unexpected path in the release index');
  const hash = createHash('sha1')
    .update('blob ' + bytes.byteLength + '\0')
    .update(bytes)
    .digest('hex');
  if (entry.slice(0, tab) !== '100644 ' + hash + ' 0')
    throw new Error('Release blob differs from audit');
}
git(output, '-c', 'commit.gpgsign=false', 'commit', '-m', 'Initial public source snapshot');
const identity = git(output, 'log', '-1', '--format=%an%n%ae%n%cn%n%ce').trim();
if (
  git(output, 'rev-list', '--count', 'HEAD').trim() !== '1' ||
  git(output, 'remote').trim() ||
  identity !== [publicName, publicEmail, publicName, publicEmail].join('\n')
) {
  throw new Error('Unexpected release history or remote');
}
log('Verified ' + files.size + ' files in ' + output);
