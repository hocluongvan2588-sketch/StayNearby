/* Screenshot the Community surfaces (dev-time tooling; requires
   `npm i --no-save puppeteer-core @sparticuz/chromium` and LD_LIBRARY_PATH
   pointing at the brotli-extracted NSS libs). */
/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = 'artifacts';
fs.mkdirSync(OUT, { recursive: true });
const ADMIN_EMAIL = 'admin@vietnomad.demo';
const ADMIN_PASSWORD = 'AdminOps!2026';

async function newPage(browser, { width, height, locale, isMobile = false }) {
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: isMobile ? 2 : 1,
    isMobile,
    hasTouch: isMobile,
  });
  await page.setCookie({
    name: 'vn_locale',
    value: locale,
    domain: 'localhost',
    path: '/',
  });
  return page;
}

async function settle(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1200));
}

async function shoot(browser, { name, path, width, height, locale, isMobile = false, fullPage = true }) {
  const page = await newPage(browser, { width, height, locale, isMobile });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`saved ${name}.png`);
  await page.close();
}

async function shootAdmin(browser) {
  const page = await newPage(browser, { width: 1440, height: 900, locale: 'vi' });

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  await settle(page);
  await page.type('input[type="email"]', ADMIN_EMAIL);
  await page.type('input[type="password"]', ADMIN_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  await settle(page);

  // Pending review tab (shows the public submission from E2E)
  await page.goto(`${BASE}/admin/growth/community`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await settle(page);
  await page.screenshot({ path: `${OUT}/admin-community-pending.png`, fullPage: true });
  console.log('saved admin-community-pending.png');

  // Open the first event drawer (actions + review history)
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.trim() === 'Open'
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}/admin-community-drawer.png`, fullPage: false });
    console.log('saved admin-community-drawer.png');
  } else {
    console.log('WARN: no Open button found for drawer shot');
  }

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    await shoot(browser, {
      name: 'community-desktop-vi',
      path: '/community',
      width: 1440,
      height: 900,
      locale: 'vi',
    });
    await shoot(browser, {
      name: 'community-mobile-vi',
      path: '/community',
      width: 390,
      height: 844,
      locale: 'vi',
      isMobile: true,
    });
    await shoot(browser, {
      name: 'event-detail-vi',
      path: '/community/da-nang-an-thuong-brunch',
      width: 1440,
      height: 900,
      locale: 'vi',
    });
    await shoot(browser, {
      name: 'event-submit-form-vi',
      path: '/community/submit',
      width: 1440,
      height: 900,
      locale: 'vi',
    });
    await shoot(browser, {
      name: 'event-detail-mobile-vi',
      path: '/community/da-nang-an-thuong-brunch',
      width: 390,
      height: 844,
      locale: 'vi',
      isMobile: true,
    });
    await shootAdmin(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
