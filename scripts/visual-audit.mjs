import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const FRONTEND = 'http://localhost:8342';
const OUT = '/tmp/volum-screens';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function shot(name, page, opts = {}) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log(`saved ${path}`);
}

// --- Login screen ---
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(FRONTEND, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('01-login-light', page);

// Dark mode login
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.waitForTimeout(500);
await shot('02-login-dark', page);

// --- Log in (try default credentials) ---
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.waitForTimeout(300);

// Check what's on the login screen
const loginHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 2000));
console.log('Login page HTML preview:', loginHtml.slice(0, 500));

// Try to find and fill login fields
const inputs = await page.locator('input').all();
console.log(`Found ${inputs.length} inputs on login page`);
for (const inp of inputs) {
  const type = await inp.getAttribute('type');
  const placeholder = await inp.getAttribute('placeholder');
  console.log(`  input: type=${type} placeholder=${placeholder}`);
}

// Try logging in with common defaults
try {
  await page.fill('input[type="text"], input[name="username"], input[placeholder*="ser" i]', 'admin');
  await page.fill('input[type="password"]', 'admin');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign")');
  await page.waitForTimeout(3000);
} catch (e) {
  console.log('Login attempt failed:', e.message.slice(0, 100));
}

await shot('03-after-login-attempt', page);

// Check if we're logged in or still on login
const url = page.url();
console.log('Current URL:', url);
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
console.log('Body text preview:', bodyText.slice(0, 300));

await browser.close();
console.log('Done');
