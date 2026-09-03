// Screenshot the curation page states.
import puppeteer from 'puppeteer-core';

const PAGE_URL = process.env.URL || 'http://127.0.0.1:5188/curate.html';
const OUT = new URL('../shots/', import.meta.url).pathname;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 2 });
await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.cu-cover', { timeout: 30000 });
await sleep(2500); // let visible covers load

await page.screenshot({ path: OUT + 'c1-overview.png' });

// scroll to a dense era
await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.cu-band-label')];
  const t = heads.find(h => h.textContent.startsWith('2023'));
  t?.scrollIntoView();
});
await sleep(2200);
await page.screenshot({ path: OUT + 'c2-2023.png' });

// suggested filter
await page.evaluate(() => [...document.querySelectorAll('.cu-f')].find(b => b.textContent.trim() === 'suggested')?.click());
await sleep(1800);
await page.screenshot({ path: OUT + 'c3-suggested.png' });

// open a detail panel on a suggested cover + set a verdict
await page.evaluate(() => document.querySelectorAll('.cu-cover')[2]?.click());
await sleep(900);
await page.screenshot({ path: OUT + 'c4-panel.png' });
const panelInfo = await page.evaluate(() => ({
  album: document.querySelector('.cu-panel-album')?.textContent,
  artist: document.querySelector('.cu-panel-artist')?.textContent,
  rows: [...document.querySelectorAll('.cu-ev-row')].map(r => r.textContent),
}));
console.log('panel:', JSON.stringify(panelInfo, null, 1));

await page.keyboard.press('k');
await sleep(600);
const after = await page.evaluate(() => ({
  keeps: JSON.parse(localStorage.getItem('mt-verdicts') || '{}'),
  nowFocused: document.querySelector('.cu-panel-album')?.textContent,
}));
console.log('after k:', JSON.stringify(after));
await page.screenshot({ path: OUT + 'c5-verdict.png' });

await browser.close();
console.log('done');
