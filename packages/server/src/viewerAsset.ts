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

const STUB_HTML = `<!doctype html><html><body><h1>viewer not built</h1></body></html>`;
const STUB_JS = `console.warn('viewer bundle missing');`;

export function loadViewerHtml(): string {
  if (cachedHtml !== null) return cachedHtml;
  const dir = findBundleDir();
  cachedHtml = dir ? fs.readFileSync(path.join(dir, 'index.html'), 'utf8') : STUB_HTML;
  return cachedHtml;
}

export function loadViewerJs(): string {
  if (cachedJs !== null) return cachedJs;
  const dir = findBundleDir();
  cachedJs = dir ? fs.readFileSync(path.join(dir, 'viewer.js'), 'utf8') : STUB_JS;
  return cachedJs;
}
