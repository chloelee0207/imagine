# Reimagine

Brand-new challenge cards for **Imagine**, the visual charades game
(Gamewright, 2016). The cards in the box are ten years old now, so this site
deals new ones, with new categories and current words.

**Use it:** https://chloelee0207.github.io/imagine/ (after the one-time
setup under [Deploying](#deploying)).

Locally, open `index.html` in a browser. There is no build step and nothing to
install.

## At the table

Tap **Draw a new card** for a two-sided card with 8 numbered category and word
pairs per side, 16 words in all, just like the printed cards. The player next
to you calls the number as usual.

On a phone, swipe the card left or right to turn it over. On a wider screen
both sides sit next to each other. The screen stays awake while the page is
open, where the browser allows it.

Keyboard: `N` new card, `F` flip, `←` `→` earlier and later cards.

## The deck

1,920 words in 48 categories, enough for 120 cards before anything repeats (the original box has 65). Asian and Southeast Asian
references run all through it: K-pop and K-dramas, anime, satay and bánh mì,
Songkran and Hari Raya, Grab and Shopee, the Merlion and the Petronas Towers.

| Group | Categories |
| --- | --- |
| Screen | Streaming Series, Recent Movie, Animated Character, Anime & Manga, Superhero or Villain, Movie or TV Character |
| People & Music | Pop Star, Hit Song, Athlete, Movie Star, Famous Personality, History Maker |
| Online | Video Game, Game Character, App or Website, Viral Moment, Emoji |
| Everyday | Gadget, Around the House, In the Kitchen, Something to Wear, Modern Life, Job |
| Food | Street Food, Meal or Dish, Snack or Dessert, Drink, Fruit or Veggie |
| Nature & Science | Wild Animal, Pet, Weather & Nature, Outer Space, Science & Tech |
| Places & Travel | Famous Landmark, City or Country, Place in Town, Travel & Vacation, Vehicle |
| Play | Sport, Hobby, Toy or Game |
| Words & Actions | Slang, Saying or Idiom, Feeling or Mood, Action |
| Stories & Occasions | Fairy Tale or Myth, Mythical Creature, Celebration |

- **No repeats.** Words you have seen stay out of new cards on that device
  until the whole deck has come up, then it reshuffles. **Start the deck over**
  at the bottom of the page puts everything back.
- **Pick your categories.** The **Categories** button switches any of them on
  or off, for example to leave out pop culture for a younger crowd. Each side
  of a card uses 8 different categories whenever at least 8 are on.
- **Go back.** The arrows step through the last 60 cards you drew, so an
  accidental tap on Draw doesn't lose a card.

Progress is kept in the browser's local storage, so it is per device and per
browser.

## Adding your own words

Every category lives in `js/data/` as a plain list:

```js
{
  id: "snack",              // stable id, used to remember seen words
  name: "Snack or Dessert", // printed on the card
  words: ["Popcorn", "Nachos", ...]
}
```

Add words to a list, or add a new `{ id, name, words }` block to any file.
A new file in `js/data/` also needs a `<script>` line in `index.html`. Then run
the checker, which rejects duplicates across the whole deck, overly long
entries and anything reused from the original cards:

```
node tests/lint-words.js
```

## Files

```
index.html          page shell
css/style.css       card look, layout, light and dark themes
js/app.js           dealing, no-repeat memory, history, categories, swipe to flip
js/data/*.js        the categories and words, one file per group
tests/lint-words.js word list checks
tests/app.test.js   browser test (dealing, repeats, history, layout)
```

## Tests

```
node tests/lint-words.js
npm install --no-save playwright && npx playwright install chromium   # once
node tests/app.test.js
```

`app.test.js` serves the folder itself, then deals the entire deck in headless
Chromium and checks that no word repeats before the reshuffle, that category
filters hold, that history survives a reload, and that the page never scrolls
sideways at phone widths. It exits non-zero on failure. `SHOTS=some/dir` also
saves screenshots.

## Deploying

`.github/workflows/pages.yml` publishes the repo root to GitHub Pages on every
push. Nothing is built or bundled; the files are uploaded as they are.

One-time setup, needed because a workflow token is not allowed to create a
Pages site: go to **Settings → Pages → Build and deployment** and set
**Source** to **GitHub Actions**. Then re-run the latest workflow (or push any
commit).

**Deploy from a branch** (branch `claude/imagine-card-generator-uvihp1`, folder
`/ (root)`) works just as well, because nothing is built. If you switch to it,
delete `.github/workflows/pages.yml`, which is only needed for the GitHub
Actions source.

---

Unofficial and fan-made. Imagine is a game by Gamewright; this project is not
affiliated with or endorsed by them.
