// Drives the real page in headless Chromium and checks the dealing rules.
// Run: node tests/app.test.js   (needs the "playwright" package)
// SHOTS=dir also saves screenshots there.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const SHOTS = process.env.SHOTS;

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, url === "/" ? "index.html" : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

let failures = 0;
function check(ok, label) {
  console.log((ok ? "  ok   " : "  FAIL ") + label);
  if (!ok) failures++;
}

const readCard = (page) => page.$$eval(".face", (faces) => faces.map((f) =>
  [...f.querySelectorAll(".row")].map((r) => ({ cat: r.querySelector(".cat").textContent, word: r.querySelector(".word").textContent }))));

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];

  // ---------- phone ----------
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, ignoreHTTPSErrors: !!process.env.IGNORE_TLS });
  const page = await phone.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  // Web fonts are optional (the page falls back to system fonts), so their network errors don't count.
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)\.com/.test(m.location().url || "")) errors.push(m.text()); });
  await page.goto(base);
  await page.waitForSelector(".row");

  const total = await page.evaluate(() => window.REIMAGINE_DATA.flatMap((g) => g.categories).reduce((n, c) => n + c.words.length, 0));
  const first = await readCard(page);
  check(first.length === 2 && first.every((s) => s.length === 8), "a card opens with two sides of 8");
  check(new Set(first.flat().map((r) => r.word)).size === 16, "the 16 words on a card are all different");
  check(new Set(first[0].map((r) => r.cat)).size === 8, "no category repeats on a side");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "phone-light.png"), fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 0, `no sideways scroll at 375px (overflow ${overflow}px)`);

  // Deal the whole deck: nothing may repeat until it runs out.
  const fullCards = Math.floor(total / 16);
  const seen = new Set(first.flat().map((r) => r.cat + "|" + r.word));
  let repeats = 0;
  for (let i = 1; i < fullCards; i++) {
    await page.click("#draw");
    for (const r of (await readCard(page)).flat()) {
      const key = r.cat + "|" + r.word;
      if (seen.has(key)) repeats++;
      seen.add(key);
    }
  }
  check(repeats === 0, `${fullCards} cards (${seen.size} of ${total} words) dealt with no repeats`);
  const leftBefore = await page.textContent("#status");
  await page.click("#draw");
  const afterShuffle = await page.textContent("#status");
  check(/reshuffled/.test(afterShuffle), `deck reshuffles when it runs out ("${leftBefore}" -> "${afterShuffle}")`);

  // History survives a reload.
  const shown = await readCard(page);
  await page.click("#prev");
  const prev = await readCard(page);
  check(JSON.stringify(prev) !== JSON.stringify(shown), "previous card button goes back");
  await page.click("#next");
  check(JSON.stringify(await readCard(page)) === JSON.stringify(shown), "next card button comes forward again");
  await page.reload();
  await page.waitForSelector(".row");
  check(JSON.stringify(await readCard(page)) === JSON.stringify(shown), "the current card is still there after a reload");

  // Flip and spotlight.
  await page.click("#sideB");
  check(await page.$eval("#flipper", (el) => el.classList.contains("flipped")), "Side B flips the card");
  check(await page.$eval("#faceA", (el) => el.inert), "the hidden side is inert on phones");
  await page.waitForTimeout(650);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "phone-side-b.png") });
  await page.click("#sideA");
  await page.waitForTimeout(650);
  await page.click("#roll");
  await page.waitForTimeout(700);
  const lit = await page.$$eval("#faceA .row.on", (rows) => rows.map((r) => r.dataset.num));
  check(lit.length === 1, `rolling spotlights one number (${lit.join(",")})`);
  await page.click(`#faceA .row[data-num="${lit[0]}"] .num`);
  check((await page.$$("#faceA .row.on")).length === 0, "tapping the spotlit number clears it");
  await page.click('#faceA .row[data-num="3"] .num');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "phone-spotlight.png") });

  // Categories: limit to one and deal from it only.
  await page.click("#openCats");
  await page.click("#noCats");
  check(await page.$eval("#catsDone", (b) => b.disabled), "Done is disabled with no categories");
  await page.click('label.chip:has(#cat-emoji)');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "phone-categories.png") });
  await page.click("#catsDone");
  await page.click("#draw");
  const emojiCard = (await readCard(page)).flat();
  check(emojiCard.every((r) => r.cat === "Emoji"), "with one category on, every row comes from it");
  check(new Set(emojiCard.map((r) => r.word)).size === 16, "…and still no repeated word on the card");
  check((await page.textContent("#catCount")).trim() === "1/45", "the header shows 1/45 categories");
  await page.click("#openCats");
  await page.click("#allCats");
  await page.click("#catsDone");

  // Starting over needs two taps.
  await page.click("#reset");
  check(/again/.test(await page.textContent("#reset")), "first tap on reset only asks for confirmation");
  await page.click("#reset");
  check((await page.textContent("#cardNo")).trim() === "1", "second tap restarts at card 1");
  const status = await page.textContent("#status");
  check(status.includes((total - 16).toLocaleString("en-US")), `status counts the fresh deck ("${status}")`);

  // Dark theme renders.
  await page.emulateMedia({ colorScheme: "dark" });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === "rgb(15, 22, 24)", `dark theme applies (${bg})`);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "phone-dark.png"), fullPage: true });

  // ---------- small phone ----------
  const tiny = await browser.newPage({ viewport: { width: 320, height: 640 } });
  await tiny.goto(base);
  await tiny.waitForSelector(".row");
  const tinyOverflow = await tiny.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(tinyOverflow <= 0, `no sideways scroll at 320px (overflow ${tinyOverflow}px)`);
  if (SHOTS) await tiny.screenshot({ path: path.join(SHOTS, "phone-320.png"), fullPage: true });

  // ---------- desktop ----------
  const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  desk.on("pageerror", (e) => errors.push(e.message));
  await desk.goto(base);
  await desk.waitForSelector(".row");
  const [a, b] = await Promise.all([desk.$eval("#faceA", (e) => e.getBoundingClientRect().toJSON()), desk.$eval("#faceB", (e) => e.getBoundingClientRect().toJSON())]);
  check(Math.abs(a.top - b.top) < 1 && b.left >= a.right, "desktop shows both sides next to each other");
  check(!(await desk.isVisible(".sides")), "side switch is hidden on desktop");
  await desk.keyboard.press("n");
  check((await desk.textContent("#cardNo")).trim() !== "", "N key draws a card");
  if (SHOTS) await desk.screenshot({ path: path.join(SHOTS, "desktop.png"), fullPage: true });

  check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
