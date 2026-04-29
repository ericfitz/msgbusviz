import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const BUNDLE_CANDIDATES = [
  path.resolve(here, '../../viewer/dist-bundle'),
  path.resolve(here, '../../../viewer/dist-bundle'),
];

function findBundleDir(): string | null {
  for (const c of BUNDLE_CANDIDATES) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

let cachedHtml: string | null = null;
let cachedJs: string | null = null;
let cachedJsHash: string | null = null;

const STUB_HTML = `<!doctype html><html><body><h1>viewer not built</h1></body></html>`;
const STUB_JS = `console.warn('viewer bundle missing');`;

function ensureLoaded(): void {
  if (cachedJs !== null) return;
  const dir = findBundleDir();
  if (dir) {
    cachedJs = fs.readFileSync(path.join(dir, 'viewer.js'), 'utf8');
    cachedJsHash = crypto.createHash('sha1').update(cachedJs).digest('hex').slice(0, 10);
    const rawHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    cachedHtml = rawHtml.replace(/(\/viewer\.js)(?!\?)/g, `$1?v=${cachedJsHash}`);
  } else {
    cachedJs = STUB_JS;
    cachedHtml = STUB_HTML;
    cachedJsHash = '';
  }
}

export function loadViewerHtml(): string {
  ensureLoaded();
  return cachedHtml ?? STUB_HTML;
}

export function loadViewerJs(): string {
  ensureLoaded();
  return cachedJs ?? STUB_JS;
}
