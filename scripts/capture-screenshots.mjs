#!/usr/bin/env node
// Capture screenshots of Volum for README/docs.
// Usage: node scripts/capture-screenshots.mjs
// Prerequisites: npm run setup-visual (installs Playwright + browsers)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const URL = process.env.VOLUM_URL || 'http://localhost:8090';
const VIEWPORT = { width: 1280, height: 800 };

async function shot(page, name, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  -> docs/screenshots/${name}.png`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setViewport(VIEWPORT);

console.log('Capturing screenshots...');

await page.goto(URL, { waitUntil: 'networkidle' });
await shot(page, 'desktop', '.desktop');

await page.goto(`${URL}/#/storage`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot(page, 'file-grid', '.fileGrid');

await browser.close();
console.log('Done. Upload screenshots to the repo and update README.md.');
