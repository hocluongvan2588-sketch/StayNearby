/* Stay Extras acceptance screenshots (spec §18): host editor, stay detail,
   checkout, host reservation drawer, my trips, admin tab, help article,
   plus a mobile stay-detail shot. Requires the dev DB seeded with demo
   extras data (scripts/_setup-extras-demo.ts) and `npm run start`.
   Dev-time tooling: npm i --no-save puppeteer-core @sparticuz/chromium */
/* eslint-disable @typescript-eslint/no-require-imports */
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;

const BASE = 'http://localhost:3000';
const OUT = 'artifacts';
const BOOKING_CODE = process.env.EXTRAS_BOOKING_CODE || 'VN-107536';
const STAY_SLUG = 'tay-ho-jade-residence-hanoi';

async function login(page, email, password, next) {
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
  ]);
}

async function shot(page, name, { scrollTo, selector, fullPage = false } = {}) {
  if (scrollTo) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ block: 'start' });
    }, scrollTo);
  }
  await new Promise((r) => setTimeout(r, 1200));
  if (selector) {
    const el = await page.$(selector);
    if (el) {
      await el.screenshot({ path: `${OUT}/${name}.png` });
      console.log(`saved ${name}.png (element)`);
      return;
    }
  }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`saved ${name}.png`);
}

async function newPage(browser, { mobile = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({
    width: mobile ? 390 : 1440,
    height: mobile ? 844 : 900,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await page.setCookie({
    name: 'vn_locale',
    value: 'vi',
    domain: 'localhost',
    path: '/',
  });
  return page;
}

(async () => {
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    // 1. Host editor — "4b. Dịch vụ bổ sung"
    {
      const page = await newPage(browser);
      await login(page, 'host@vietnomad.demo', 'HostFlow!2026', '/host/listings');
      await page.goto(`${BASE}/host/listings`, { waitUntil: 'networkidle0', timeout: 60000 });
      // Open THE listing that has extras declared (tay-ho jade stay id).
      const editorHref = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('a')).find((el) =>
          (el.getAttribute('href') || '').includes('/host/listings/40000000-0000-4000-8000-000000000002')
        );
        return a ? a.getAttribute('href') : null;
      });
      if (editorHref) {
        await page.goto(`${BASE}${editorHref}`, { waitUntil: 'networkidle0', timeout: 60000 });
      }
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Dịch vụ bổ sung')
        );
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 2000));
      // Expand the first editable service card.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.trim() === 'Chỉnh sửa'
        );
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 1500));
      await shot(page, 'extras-host-editor-desktop');
      await page.close();
    }

    // 2. Stay detail — extras section (desktop)
    {
      const page = await newPage(browser);
      await page.goto(`${BASE}/stays/${STAY_SLUG}`, {
        waitUntil: 'networkidle0',
        timeout: 90000,
      });
      await shot(page, 'extras-stay-detail-desktop', { scrollTo: '#extra-services' });
      await page.close();
    }

    // 3. Stay detail mobile
    {
      const page = await newPage(browser, { mobile: true });
      await page.goto(`${BASE}/stays/${STAY_SLUG}`, {
        waitUntil: 'networkidle0',
        timeout: 90000,
      });
      await shot(page, 'extras-stay-detail-mobile', { scrollTo: '#extra-services' });
      await page.close();
    }

    // 4. Checkout widget — optional service checkboxes
    {
      const page = await newPage(browser);
      await login(page, 'nomad@vietnomad.demo', 'NomadPass!2026', `/stays/${STAY_SLUG}`);
      await page.goto(`${BASE}/stays/${STAY_SLUG}`, {
        waitUntil: 'networkidle0',
        timeout: 90000,
      });
      await page.evaluate(() => {
        const label = Array.from(document.querySelectorAll('p')).find((p) =>
          p.textContent?.includes('Dịch vụ bổ sung (tùy chọn)')
        );
        if (label) label.scrollIntoView({ block: 'center' });
      });
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'extras-checkout-desktop');
      await page.close();
    }

    // 5. Host reservation drawer — service requests panel
    {
      const page = await newPage(browser);
      await login(page, 'host@vietnomad.demo', 'HostFlow!2026', '/host/reservations');
      await page.goto(`${BASE}/host/reservations`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.evaluate((code) => {
        const row = Array.from(document.querySelectorAll('button, tr, [role="button"], a')).find((el) =>
          el.textContent?.includes(code)
        );
        if (row) row.click();
      }, BOOKING_CODE);
      await new Promise((r) => setTimeout(r, 2500));
      await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('div')).find((el) =>
          el.textContent?.trim() === 'Dịch vụ bổ sung' && el.children.length <= 2
        );
        if (h) h.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'extras-host-reservation-desktop');
      await page.close();
    }

    // 6. My Trips — prepare-for-your-stay panel
    {
      const page = await newPage(browser);
      await login(page, 'nomad@vietnomad.demo', 'NomadPass!2026', '/dashboard');
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('h3')).find((el) =>
          el.textContent?.includes('Chuẩn bị cho kỳ lưu trú')
        );
        if (h) h.scrollIntoView({ block: 'center' });
      });
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'extras-my-trips-desktop');
      await page.close();
    }

    // 7. Admin — bookings page, Stay Extras tab
    {
      const page = await newPage(browser);
      await login(page, 'admin@vietnomad.demo', 'AdminOps!2026', '/admin/operations/bookings');
      await page.goto(`${BASE}/admin/operations/bookings`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.trim() === 'Stay Extras'
        );
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 2500));
      await shot(page, 'extras-admin-tab-desktop');
      await page.close();
    }

    // 8. Help article (guest guide)
    {
      const page = await newPage(browser);
      await page.goto(`${BASE}/guides/dat-dich-vu-bo-sung-cho-ky-luu-tru`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
      await new Promise((r) => setTimeout(r, 1200));
      await shot(page, 'extras-help-article-desktop', { fullPage: false });
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
