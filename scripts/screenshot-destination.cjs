/* Screenshot the redesigned Destination Page (dev-time tooling; requires
   `npm i --no-save puppeteer-core @sparticuz/chromium` and LD_LIBRARY_PATH
   pointing at the brotli-extracted NSS libs). */
/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = 'artifacts';
fs.mkdirSync(OUT, { recursive: true });

async function shoot(browser, { name, path, width, height, locale, isMobile = false }) {
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
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`saved ${name}.png`);
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
      name: 'destination-da-lat-desktop-vi',
      path: '/destinations/da-lat',
      width: 1440,
      height: 900,
      locale: 'vi',
    });
    await shoot(browser, {
      name: 'destination-da-lat-mobile-vi',
      path: '/destinations/da-lat',
      width: 390,
      height: 844,
      locale: 'vi',
      isMobile: true,
    });
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
