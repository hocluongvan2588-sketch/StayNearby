/* Screenshot the homepage desktop + mobile (dev-time tooling; requires
   `npm i --no-save puppeteer-core @sparticuz/chromium`). */
/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const BASE = 'http://localhost:3000';
const OUT = 'artifacts';

async function shoot(browser, { name, width, height, locale, isMobile = false }) {
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
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 60000 });
  // let webfonts + late images settle
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
    await shoot(browser, { name: 'home-desktop-vi', width: 1440, height: 900, locale: 'vi' });
    await shoot(browser, { name: 'home-mobile-vi', width: 390, height: 844, locale: 'vi', isMobile: true });
    await shoot(browser, { name: 'home-desktop-en', width: 1440, height: 900, locale: 'en' });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
