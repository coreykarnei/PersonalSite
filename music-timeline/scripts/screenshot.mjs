// Drive local Chromium headless to capture the timeline at a few states.
import puppeteer from 'puppeteer-core';

const PAGE_URL = process.env.URL || 'http://127.0.0.1:5188/';
const OUT = new URL('../shots/', import.meta.url).pathname;
const W = 1440, H = 860;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});

const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.goto(PAGE_URL, { waitUntil: 'networkidle0', timeout: 60000 });

// wait for covers to actually paint
await page.waitForSelector('.mt-cover img', { timeout: 20000 });
await page.evaluate(async () => {
  const imgs = [...document.querySelectorAll('.mt-cover img')];
  await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(500);

// 1) overview at the sparse start
await page.evaluate(() => { document.querySelector('.mt-scroll').scrollLeft = 0; });
await sleep(300);
await page.screenshot({ path: OUT + '01-overview.png' });

// 2) the middle of the arc — the taste opening up
await page.evaluate(() => {
  const el = document.querySelector('.mt-scroll');
  el.scrollLeft = Math.round(el.scrollWidth * 0.34);
});
await sleep(400);
await page.screenshot({ path: OUT + '04-mid.png' });

// 3) a dense recent era
await page.evaluate(() => {
  const el = document.querySelector('.mt-scroll');
  el.scrollLeft = Math.round(el.scrollWidth * 0.68);
});
await sleep(400);
await page.screenshot({ path: OUT + '02-dense.png' });

// 3) hover a cover to show the tooltip + spotlight
const box = await page.evaluate(() => {
  const scroll = document.querySelector('.mt-scroll');
  const covers = [...document.querySelectorAll('.mt-cover')];
  // pick a cover comfortably inside the viewport, mid-height
  const vw = window.innerWidth, vh = window.innerHeight;
  const inView = covers
    .map(c => ({ c, r: c.getBoundingClientRect() }))
    .filter(({ r }) => r.left > vw * 0.3 && r.right < vw * 0.85 && r.top > vh * 0.25 && r.bottom < vh * 0.8);
  const pick = inView[Math.floor(inView.length / 2)] || { r: covers[0].getBoundingClientRect() };
  return { x: pick.r.left + pick.r.width / 2, y: pick.r.top + pick.r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await sleep(450);
await page.screenshot({ path: OUT + '03-hover.png' });

// 4) click the hovered cover to show the committed "playing" state (ring + snippet bar)
await page.mouse.click(box.x, box.y);
await sleep(1600); // let the audio load + playback advance
const audioState = await page.evaluate(() => {
  const a = window.__mtAudio;
  if (!a) return { present: false };
  return { present: true, paused: a.paused, currentTime: +a.currentTime.toFixed(2), duration: +(a.duration || 0).toFixed(1), readyState: a.readyState, networkState: a.networkState, src: (a.src || '').slice(0, 48) };
});
console.log('audio state:', JSON.stringify(audioState));
await page.screenshot({ path: OUT + '05-selected.png' });

// 4b) drag the OUT handle to prove the snippet picker is interactive
const beforeTimes = await page.evaluate(() => document.querySelector('.mt-picker-times')?.textContent);
const handle = await page.evaluate(() => {
  const h = document.querySelector('.mt-picker-h-r');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (handle) {
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(handle.x + i * 9, handle.y); await sleep(16); }
  await page.mouse.up();
  await sleep(300);
}
const afterTimes = await page.evaluate(() => document.querySelector('.mt-picker-times')?.textContent);
console.log('picker times before:', JSON.stringify(beforeTimes), '-> after:', JSON.stringify(afterTimes));
await page.screenshot({ path: OUT + '06-picker.png' });

// 5) sanity-check drag-to-pan: press, move left, release, confirm scrollLeft changed
const dragResult = await (async () => {
  const before = await page.evaluate(() => document.querySelector('.mt-scroll').scrollLeft);
  await page.mouse.move(700, 300);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(700 - i * 60, 300); await sleep(16); }
  await page.mouse.up();
  const after = await page.evaluate(() => document.querySelector('.mt-scroll').scrollLeft);
  return { before, after, delta: after - before };
})();
console.log('drag-pan check:', JSON.stringify(dragResult));

await browser.close();
console.log('shots written to shots/');
