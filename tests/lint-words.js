// Checks the word lists: no duplicates anywhere, nothing lifted from the
// original 2016 card, sensible lengths. Run: node tests/lint-words.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dataDir = path.join(__dirname, "..", "js", "data");
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith(".js")).sort()) {
  vm.runInContext(fs.readFileSync(path.join(dataDir, file), "utf8"), sandbox, { filename: file });
}

// The eight words printed on the card in the original photo.
const ORIGINAL = [
  "Love At First Sight", "Sylvester Stallone", "Earmuffs", "Money",
  "Chicken", "Chewbacca", "Miniature Golf", "Toothbrush",
];
const MAX_LEN = 34;
const MIN_PER_CATEGORY = 30;

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const problems = [];
const seenWord = new Map();
const seenId = new Set();
let total = 0;
const catNames = new Set(sandbox.window.REIMAGINE_DATA.flatMap((g) => g.categories).map((c) => norm(c.name)));

for (const group of sandbox.window.REIMAGINE_DATA) {
  for (const cat of group.categories) {
    if (seenId.has(cat.id)) problems.push(`duplicate category id "${cat.id}"`);
    seenId.add(cat.id);
    if (cat.words.length < MIN_PER_CATEGORY) problems.push(`${cat.name}: only ${cat.words.length} words`);
    for (const word of cat.words) {
      total++;
      const key = norm(word);
      if (seenWord.has(key)) problems.push(`duplicate "${word}" in ${cat.name} and ${seenWord.get(key)}`);
      seenWord.set(key, cat.name);
      if (word.length > MAX_LEN) problems.push(`too long (${word.length}): "${word}"`);
      if (word !== word.trim() || /\s{2,}/.test(word)) problems.push(`stray whitespace: "${word}"`);
      for (const old of ORIGINAL) {
        if (key === norm(old)) problems.push(`"${word}" is on the original card`);
      }
      if (catNames.has(key)) problems.push(`"${word}" in ${cat.name} is just a category name`);
    }
  }
}

const cats = sandbox.window.REIMAGINE_DATA.flatMap((g) => g.categories);
console.log(`${cats.length} categories, ${total} words, ${Math.floor(total / 16)} full cards before any repeat`);
for (const c of cats) console.log(`  ${String(c.words.length).padStart(3)}  ${c.name}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("\nOK");
