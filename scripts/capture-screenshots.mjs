#!/usr/bin/env node
// Capture screenshots of Volum for README/docs.
// Usage: node scripts/capture-screenshots.mjs
// Prerequisites: make setup-visual (installs Playwright + browsers)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const URL = process.env.VOLUM_URL || 'http://localhost:8090';
const VIEWPORT = { width: 1280, height: 800 };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT });

console.log('Capturing screenshots...');

await page.goto(URL, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(OUT, 'desktop.png') });

await browser.close();
console.log('Captured docs/screenshots/desktop.png');
