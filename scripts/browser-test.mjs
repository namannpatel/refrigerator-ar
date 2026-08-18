import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto('http://localhost:5174/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const loadingHidden = await page.evaluate(() =>
  document.getElementById('loading-screen').classList.contains('hidden'),
);
const errorVisible = await page.evaluate(() =>
  !document.getElementById('error-screen').classList.contains('hidden'),
);
const errorText = await page.evaluate(() => document.getElementById('error-message').textContent);

const canvasInfo = await page.evaluate(() => {
  const canvas = document.getElementById('three-canvas');
  return {
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
  };
});

console.log('loadingHidden', loadingHidden);
console.log('errorVisible', errorVisible);
console.log('errorText', errorText);
console.log('canvas', canvasInfo);
console.log('errors', errors);

await browser.close();
