#!/usr/bin/env node
// Capture screenshots of Volum for README/docs.
// Usage: node scripts/capture-screenshots.mjs
// Requires: npm install puppeteer (or: npx puppeteer browsers install)

import puppeteer from 'puppeteer';
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

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.setViewport(VIEWPORT);

console.log('Capturing screenshots...');

// 1. Desktop view
await page.goto(URL, { waitUntil: 'networkidle0' });
await shot(page, 'desktop', '.desktop');

// 2. File grid (navigate to /storage)
await page.goto(`${URL}/#/storage`, { waitUntil: 'networkidle0' });
await page.waitForTimeout(1000);
await shot(page, 'file-grid', '.fileGrid');

// 3. Preview modal (click first image if any, or skip)
// 4. Job drawer
// 5. Settings page
// 6. Share dialog

await browser.close();
console.log('Done. Upload screenshots to the repo and update README.md.');
