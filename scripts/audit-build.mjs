import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const strict = process.argv.includes('--strict');
const maxInitialScriptBytes = 600 * 1024;
const maxInitialStyleBytes = 180 * 1024;
const entryHtml = fs.existsSync(path.join(DIST_DIR, 'index.html'))
  ? fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8')
  : '';

if (!fs.existsSync(DIST_DIR)) {
  console.error('[audit:build] dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

const htmlFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(entryPath);
    else if (entry.name.endsWith('.html')) htmlFiles.push(entryPath);
  }
};
visit(DIST_DIR);

const getMatches = (value, pattern) => [...value.matchAll(pattern)].map((match) => match[0]);
const warnings = [];
const errors = [];
const localStylesheetPattern = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
const localAssetPattern = /^(?:.*\/)?assets\/(.+\.css)$/;
const localStylesheets = new Set();

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(DIST_DIR, filePath) || 'index.html';
  const canonicalCount = getMatches(html, /<link\b[^>]*\brel=["']canonical["'][^>]*>/gi).length;
  const jsonLdTags = getMatches(html, /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
  const rootContent = html.match(/<div\b[^>]*\bid=["']root["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]?.trim() || '';

  for (const match of html.matchAll(localStylesheetPattern)) {
    const href = match[1].split(/[?#]/, 1)[0];
    const assetMatch = href.match(localAssetPattern);
    if (!assetMatch) continue;
    const assetPath = path.join(DIST_DIR, 'assets', assetMatch[1]);
    localStylesheets.add(assetPath);
    if (!fs.existsSync(assetPath)) {
      errors.push(`${relativePath}: stylesheet not found (${href})`);
    }
  }

  const isOfflineFallback = relativePath === 'offline.html';
  if (!/<title>[\s\S]+<\/title>/i.test(html)) errors.push(`${relativePath}: missing title`);
  if (!isOfflineFallback && !/<meta\b[^>]*\bname=["']description["'][^>]*>/i.test(html)) errors.push(`${relativePath}: missing description`);
  if (!isOfflineFallback && !/<meta\b[^>]*\bname=["']robots["'][^>]*>/i.test(html)) errors.push(`${relativePath}: missing robots`);
  if (canonicalCount > 1) errors.push(`${relativePath}: duplicate canonical tags (${canonicalCount})`);
  if (jsonLdTags.length === 0) warnings.push(`${relativePath}: missing JSON-LD`);
  if (rootContent === '') warnings.push(`${relativePath}: static HTML has an empty root; content remains client-rendered`);

  for (const tag of jsonLdTags) {
    const json = tag.replace(/^.*?>/s, '').replace(/<\/script>\s*$/i, '');
    try {
      JSON.parse(json);
    } catch {
      errors.push(`${relativePath}: invalid JSON-LD`);
    }
  }
}

if (localStylesheets.size === 0) {
  errors.push('no generated local stylesheet references found');
} else {
  for (const stylesheetPath of localStylesheets) {
    if (/-[A-Za-z0-9_-]+\.css$/.test(path.basename(stylesheetPath))) {
      errors.push(`stable stylesheet has a content hash (${path.basename(stylesheetPath)})`);
    }
  }
}

if (!entryHtml.includes('https://www.clarity.ms/tag/')) {
  errors.push('entry HTML is missing the Clarity script URL');
}

const assetsDir = path.join(DIST_DIR, 'assets');
let initialScriptBytes = 0;
let initialStyleBytes = 0;
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    const filePath = path.join(assetsDir, name);
    const size = fs.statSync(filePath).size;
    if (entryHtml.includes(`assets/${name}`)) {
      if (/\.js$/.test(name)) initialScriptBytes += size;
      if (/\.css$/.test(name)) initialStyleBytes += size;
    }
  }
}
if (initialScriptBytes > maxInitialScriptBytes) warnings.push(`initial JavaScript is ${(initialScriptBytes / 1024).toFixed(1)} KiB`);
if (initialStyleBytes > maxInitialStyleBytes) warnings.push(`initial CSS is ${(initialStyleBytes / 1024).toFixed(1)} KiB`);

console.log(`[audit:build] html=${htmlFiles.length} initial-js=${(initialScriptBytes / 1024).toFixed(1)}KiB initial-css=${(initialStyleBytes / 1024).toFixed(1)}KiB`);
for (const warning of warnings) console.warn(`[audit:build] warn ${warning}`);
for (const error of errors) console.error(`[audit:build] error ${error}`);

if (errors.length > 0 || (strict && warnings.length > 0)) process.exit(1);
