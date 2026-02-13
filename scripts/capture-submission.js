const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const APP_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(APP_DIR, 'submission');
const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:3000';

const APP_INFO = {
  name: 'task-slice',
  displayName: '한입업무',
  subtitle: '한 줄 입력으로 바로 실행 계획',
  color: '#3182F6',
  iconUrl: 'https://raw.githubusercontent.com/jino123413/app-logos/master/task-slice.png',
  captions: [
    '입력 한 줄을 바로 5단계로 분해',
    '20개 유형 자동 분류로 계획 제안',
    '진행률과 연속 기록으로 실행 유지',
  ],
};

const STANDARD_FILES = [
  { file: 'thumb-square.png', width: 1000, height: 1000 },
  { file: 'thumb-landscape.png', width: 1932, height: 828 },
  { file: 'screenshot-1.png', width: 636, height: 1048 },
  { file: 'screenshot-2.png', width: 636, height: 1048 },
  { file: 'screenshot-3.png', width: 636, height: 1048 },
  { file: 'screenshot-landscape.png', width: 1504, height: 741 },
];

const LEGACY_ALIAS = {
  'thumb-square.png': 'thumbnail-square-1000x1000.png',
  'thumb-landscape.png': 'thumbnail-landscape-1932x828.png',
  'screenshot-1.png': 'screenshot-vertical-01-636x1048.png',
  'screenshot-2.png': 'screenshot-vertical-02-636x1048.png',
  'screenshot-3.png': 'screenshot-vertical-03-636x1048.png',
  'screenshot-landscape.png': 'screenshot-horizontal-01-1504x741.png',
};

const FONTS = `
<link href="https://cdn.jsdelivr.net/gh/webfontworld/gmarket/GmarketSans.css" rel="stylesheet">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
`;

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

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex, f = 0.35) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * (1 - f))},${Math.round(g * (1 - f))},${Math.round(b * (1 - f))})`;
}

function lighten(hex, f = 0.25) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`;
}

function baseStyle(w, h, color) {
  return `
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:${w}px; height:${h}px; overflow:hidden;
  background: linear-gradient(135deg, ${lighten(color, 0.1)}, ${color}, ${darken(color, 0.3)});
  font-family: 'GmarketSans', 'Pretendard Variable', sans-serif;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
}`;
}

function phoneFrameCSS(phoneW) {
  const frameR = Math.round(phoneW * 0.135);
  const screenR = Math.round(phoneW * 0.11);
  const framePad = Math.round(phoneW * 0.032);
  const notchW = Math.round(phoneW * 0.33);
  const notchH = Math.round(phoneW * 0.075);
  return `
.phone {
  width:${phoneW}px; padding:${framePad}px;
  background:#171717; border-radius:${frameR}px;
  box-shadow: 0 ${Math.round(phoneW * 0.06)}px ${Math.round(phoneW * 0.15)}px rgba(0,0,0,0.35),
              inset 0 1px 0 rgba(255,255,255,0.1);
  position:relative;
}
.phone::before {
  content:''; position:absolute;
  top:${framePad}px; left:50%; transform:translateX(-50%);
  width:${notchW}px; height:${notchH}px;
  background:#171717; border-radius:0 0 ${Math.round(notchH * 0.6)}px ${Math.round(notchH * 0.6)}px;
  z-index:10;
}
.phone .screen {
  border-radius:${screenR}px; overflow:hidden;
  background:#fff;
}
.phone .screen img {
  display:block; width:100%; height:auto;
}`;
}

function thumbSquareHTML(app, iconSrc) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}
<style>
${baseStyle(1000, 1000, app.color)}
.icon {
  width:260px; height:260px; border-radius:58px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.25);
  margin-bottom:36px; object-fit:cover;
}
h1 { color:#fff; font-size:68px; font-weight:700; margin-bottom:14px; text-shadow:0 2px 8px rgba(0,0,0,0.15); }
p { color:rgba(255,255,255,0.88); font-size:30px; font-weight:500; }
.deco { position:absolute; border-radius:50%; opacity:0.08; background:#fff; }
.d1 { width:400px; height:400px; top:-100px; right:-80px; }
.d2 { width:250px; height:250px; bottom:-60px; left:-40px; }
</style></head><body>
<div class="deco d1"></div><div class="deco d2"></div>
<img class="icon" src="${iconSrc}" />
<h1>${app.displayName}</h1>
<p>${app.subtitle}</p>
</body></html>`;
}

function thumbLandscapeHTML(app, iconSrc, screenshotB64) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}
<style>
${baseStyle(1932, 828, app.color)}
body { flex-direction:row; justify-content:space-between; padding:0 110px; position:relative; }
.left { display:flex; flex-direction:column; justify-content:center; flex:1; max-width:840px; }
.icon { width:160px; height:160px; border-radius:36px; box-shadow:0 12px 36px rgba(0,0,0,0.2); margin-bottom:28px; object-fit:cover; }
h1 { color:#fff; font-size:64px; font-weight:700; margin-bottom:12px; text-shadow:0 2px 6px rgba(0,0,0,0.12); }
p { color:rgba(255,255,255,0.86); font-size:28px; font-weight:500; max-width:600px; line-height:1.4; }
.right { display:flex; align-items:center; justify-content:center; }
${phoneFrameCSS(260)}
.deco { position:absolute; border-radius:50%; opacity:0.07; background:#fff; }
.d1 { width:500px; height:500px; top:-180px; right:160px; }
.d2 { width:300px; height:300px; bottom:-100px; left:260px; }
</style></head><body>
<div class="deco d1"></div><div class="deco d2"></div>
<div class="left">
  <img class="icon" src="${iconSrc}" />
  <h1>${app.displayName}</h1>
  <p>${app.subtitle}</p>
</div>
<div class="right">
  <div class="phone"><div class="screen"><img src="data:image/png;base64,${screenshotB64}" /></div></div>
</div>
</body></html>`;
}

function portraitHTML(app, screenshotB64, caption) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}
<style>
${baseStyle(636, 1048, app.color)}
body { justify-content:flex-start; padding-top:78px; position:relative; }
.caption {
  color:#fff; font-size:32px; font-weight:700; text-align:center;
  margin-bottom:30px; text-shadow:0 1px 4px rgba(0,0,0,0.15);
  line-height:1.35; padding:0 38px;
}
.sub { font-size:18px; font-weight:500; color:rgba(255,255,255,0.72); margin-top:8px; display:block; }
${phoneFrameCSS(290)}
.deco { position:absolute; border-radius:50%; opacity:0.06; background:#fff; }
.d1 { width:300px; height:300px; top:-80px; right:-60px; }
.d2 { width:200px; height:200px; bottom:40px; left:-40px; }
</style></head><body>
<div class="deco d1"></div><div class="deco d2"></div>
<div class="caption">${caption}<span class="sub">${app.displayName}</span></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${screenshotB64}" /></div></div>
</body></html>`;
}

function landscapeHTML(app, iconSrc, leftB64, rightB64) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${FONTS}
<style>
${baseStyle(1504, 741, app.color)}
body { flex-direction:row; gap:40px; position:relative; }
${phoneFrameCSS(210)}
.label {
  position:absolute; bottom:30px; left:50%; transform:translateX(-50%);
  color:rgba(255,255,255,0.85); font-size:40px; font-weight:600;
  text-shadow:0 1px 4px rgba(0,0,0,0.15);
}
.brand {
  position:absolute; top:28px; left:50%; transform:translateX(-50%);
  display:flex; align-items:center; gap:12px;
}
.brand img { width:44px; height:44px; border-radius:10px; }
.brand span { color:#fff; font-size:52px; font-weight:700; text-shadow:0 1px 4px rgba(0,0,0,0.12); }
.deco { position:absolute; border-radius:50%; opacity:0.06; background:#fff; }
.d1 { width:400px; height:400px; top:-120px; left:-80px; }
.d2 { width:300px; height:300px; bottom:-80px; right:-60px; }
</style></head><body>
<div class="deco d1"></div><div class="deco d2"></div>
<div class="brand"><img src="${iconSrc}"><span>${app.displayName}</span></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${leftB64}" /></div></div>
<div class="phone"><div class="screen"><img src="data:image/png;base64,${rightB64}" /></div></div>
<div class="label">${app.subtitle}</div>
</body></html>`;
}

function resolveIconSrc() {
  const localIconPath = path.resolve(APP_DIR, '..', 'app-logos', `${APP_INFO.name}.png`);
  if (fs.existsSync(localIconPath)) {
    const b64 = fs.readFileSync(localIconPath).toString('base64');
    return `data:image/png;base64,${b64}`;
  }
  return APP_INFO.iconUrl;
}

async function gotoApp(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('textarea', { timeout: 60000 });
  await page.waitForTimeout(500);
}

async function clickFirstButton(page) {
  const buttons = page.locator('button');
  const count = await buttons.count();
  if (!count) {
    throw new Error('No button found for plan generation.');
  }
  await buttons.nth(0).click();
}

async function captureRawScreens(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await gotoApp(page);
  const home = await page.screenshot({ type: 'png', fullPage: false });

  await page.fill('textarea', '다음주 발표 자료 준비하기');
  await clickFirstButton(page);
  await page.waitForTimeout(1400);
  const plan = await page.screenshot({ type: 'png', fullPage: false });

  await gotoApp(page);
  await page.fill('textarea', '주말 가족여행 준비');
  await clickFirstButton(page);
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(400);
  const progress = await page.screenshot({ type: 'png', fullPage: false });

  await context.close();
  return {
    home: home.toString('base64'),
    plan: plan.toString('base64'),
    progress: progress.toString('base64'),
  };
}

async function renderImage(browser, width, height, html, outputPath) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: outputPath, type: 'png', fullPage: false });
  await context.close();
}

function copyLegacyAliases() {
  for (const [standardFile, legacyFile] of Object.entries(LEGACY_ALIAS)) {
    const src = path.join(OUTPUT_DIR, standardFile);
    const dst = path.join(OUTPUT_DIR, legacyFile);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  }
}

async function captureSet() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const raw = await captureRawScreens(browser);
    const iconSrc = resolveIconSrc();

    const target = {
      'thumb-square.png': {
        width: 1000,
        height: 1000,
        html: thumbSquareHTML(APP_INFO, iconSrc),
      },
      'thumb-landscape.png': {
        width: 1932,
        height: 828,
        html: thumbLandscapeHTML(APP_INFO, iconSrc, raw.plan),
      },
      'screenshot-1.png': {
        width: 636,
        height: 1048,
        html: portraitHTML(APP_INFO, raw.home, APP_INFO.captions[0]),
      },
      'screenshot-2.png': {
        width: 636,
        height: 1048,
        html: portraitHTML(APP_INFO, raw.plan, APP_INFO.captions[1]),
      },
      'screenshot-3.png': {
        width: 636,
        height: 1048,
        html: portraitHTML(APP_INFO, raw.progress, APP_INFO.captions[2]),
      },
      'screenshot-landscape.png': {
        width: 1504,
        height: 741,
        html: landscapeHTML(APP_INFO, iconSrc, raw.plan, raw.progress),
      },
    };

    for (const item of STANDARD_FILES) {
      const recipe = target[item.file];
      const outputPath = path.join(OUTPUT_DIR, item.file);
      await renderImage(browser, recipe.width, recipe.height, recipe.html, outputPath);
      console.log(`Saved: ${outputPath}`);
    }

    copyLegacyAliases();
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
  await captureSet();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
