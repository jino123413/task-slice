const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const APP_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(APP_DIR, 'submission');
const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:8081';

const FILES = [
  { name: 'thumbnail-square-1000x1000.png', width: 1000, height: 1000, state: 'plan' },
  { name: 'thumbnail-landscape-1932x828.png', width: 1932, height: 828, state: 'plan' },
  { name: 'screenshot-vertical-01-636x1048.png', width: 636, height: 1048, state: 'home' },
  { name: 'screenshot-vertical-02-636x1048.png', width: 636, height: 1048, state: 'plan' },
  { name: 'screenshot-vertical-03-636x1048.png', width: 636, height: 1048, state: 'report' },
  { name: 'screenshot-horizontal-01-1504x741.png', width: 1504, height: 741, state: 'report' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode || 0);
      res.resume();
    });
    req.on('error', () => resolve(0));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await ping(url);
    if (status >= 200 && status < 500) {
      return true;
    }
    await sleep(1500);
  }
  return false;
}

async function buildPlanState(page) {
  await page.waitForSelector('textarea', { timeout: 60000 });
  await page.fill('textarea', '다음주 팀 회의 자료 준비하기');
  await page.click('button:has-text("5단계로 쪼개기")');
  await page.waitForSelector('text=유형:', { timeout: 10000 });
  await page.waitForTimeout(700);
}

async function buildReportState(page) {
  await buildPlanState(page);
  await page.click('button:has-text("주간 리포트 상세 보기")');
  await page.waitForSelector('text=주간 리포트', { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function prepareState(page, state) {
  if (state === 'home') {
    return;
  }
  if (state === 'plan') {
    await buildPlanState(page);
    return;
  }
  if (state === 'report') {
    await buildReportState(page);
  }
}

async function captureSet(baseUrl) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    for (const file of FILES) {
      const context = await browser.newContext({
        viewport: { width: file.width, height: file.height },
      });
      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=한입업무', { timeout: 60000 });
      await prepareState(page, file.state);

      const outputPath = path.join(OUTPUT_DIR, file.name);
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false,
      });
      await context.close();
      console.log(`Saved: ${outputPath}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const ready = await waitForServer(BASE_URL, 60000);
  if (!ready) {
    throw new Error(`dev server not reachable: ${BASE_URL}`);
  }

  console.log(`Using URL: ${BASE_URL}`);
  await captureSet(BASE_URL);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
