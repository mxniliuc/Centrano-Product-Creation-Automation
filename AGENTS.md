# AGENTS.md

Context for AI coding assistants (Gemini, Claude, Codex, …) working on this repo. Read this first, then
[README.md](README.md) for setup and the importer's details.

## What this is

Tools for **Pride Scootering**, a Romanian freestyle-scooter shop:

| | |
|---|---|
| Website | pridescootering.com (Shopify store `pride-scooter.myshopify.com`) |
| Instagram | @pride.scootering, managed with the Facebook Page "Pride Scootering" in Meta Business Suite |
| Supplier | Centrano (centrano.com), a dealer site with retail prices in EUR |
| Owner | @mxniliuc, who also rides for the shop's team |

Three parts:

1. **`import.js`**: Centrano → Shopify product importer (CLI). README covers it in full.
2. **`stories/`**: renders 1080×1920 Instagram story images for new products, plus a schedule board.
3. **`feed/`**: plans and renders Instagram feed posts (product carousels) and a schedule board.

Work happens on the `standalone-cli` branch, one commit per finished stage.

## Commands

```bash
npm install                      # Node 22.12+; also downloads Puppeteer's Chrome
npm test                         # node --test (test/product.test.js)

node import.js --dry-run "tilt formula deck"     # scrape only, writes output/<slug>/
node import.js "<term | Centrano search link | id:N>" ...   # create in Shopify

node stories/render.js [slug ...]   # → stories/out/<slug>.png (+ preview/ with a mock link sticker, links.txt)
node stories/board.js               # → stories/out/schedule.png

node feed/render.js [post ...]      # → feed/out/<post>/<n>.png + .jpg, feed/out/<post>.png (contact sheet)
node feed/board.js                  # → feed/out/feed-schedule.png

swiftc -O feed/shrink.swift -o feed/.build/shrink   # macOS only
feed/.build/shrink in.mp4 out.mp4 [maxMB=9]         # re-encode a clip under an upload size limit
```

`output/`, `debug/`, `stories/out/`, `feed/out/`, `feed/.build/` and `feed/clips/` are git-ignored.
Product photos used by stories and feed posts are committed in `stories/assets/`.

## Rules

- **Secrets live only in `.env`** (Centrano login, Shopify client ID/secret). Never print, log or commit it.
  `.env.example` lists the keys.
- **Nothing goes public without the owner's OK.** That covers creating products as active, posting or
  scheduling on Instagram, and downloading riders' videos. Show a preview first (a render or the board
  image), then act once they confirm.
- **Commit only when asked**, one commit per stage, with a message saying what changed for the shop.
- **Business Suite and Instagram are Romanian-language UIs** (see the playbooks below).

## Shop conventions

### Products (Shopify)

- Titles are `<type> <vendor> <model>` in Romanian product types: `Deck Tilt Nikita`, `Trotineta Core SL3`,
  `Roti Tilt Durare Barbed`, `Ghidon Pinnacle Staple`. The types, aliases and known vendors are in
  `lib/product.js`. Add a brand to `VENDORS` when a new one shows up.
- Price is Centrano retail EUR × 4.97, rounded **up** to the next 5 RON, minus 0.01 (e.g. 1244.99).
  Manual override: Core SL3 decks were set to **824.99** at the owner's request.
- Pre-order products (not yet in stock at Centrano) are still created as active. The stories and feed images say
  PRE-ORDER.
- The Shopify app needs `write_products`, `read_publications` and `write_publications`. Products are
  published to the Online Store after creation.

### Instagram stories (`stories/`)

- Each story is an entry in `stories/stories.js`: brand, title, subtitle, a red starburst price badge in LEI,
  product photos (white backgrounds, blended with multiply), optional labels, measurement arrows and a
  `tag` such as `PRE-ORDER`.
- Decks show **every available size**.
- Every story has a **link sticker** to its product page (`link`), and `linkSpot` is where the sticker goes.
  A "TAP TO SHOP" pointer is drawn above that spot. Keep the spot above y≈1700 (the Business Suite editor
  cuts off the bottom) and keep text out of the bottom ~250 px (Instagram's reply bar).
- Posting rhythm: **3–5 stories a day between 18:00 and 20:00** (`stories/schedule.js`).

### Instagram feed (`feed/`)

The owner's rules:

- **One post a day at 18:30**, repeating **team rider → product → riders who tagged us**.
- Pick riders and products that **haven't been featured recently**, and mix them.
- **No captions.** Only tag the rider(s) or the brand of the part:
  - Product carousels: tag the brand **on the first image** ("Tag people"). Leave the text empty and turn
    off automatic product tagging.
  - Rider reels and clip carousels: Business Suite can't tag people on videos, so the text is **only the
    @handles**, nothing else.
- Team rider post = one reel (the rider's recent clip). "Riders who tagged us" = a carousel of 4–5 clips
  from riders who tagged or mentioned @pride.scootering and haven't been featured.

Product carousels are defined in `feed/posts.js` (1080×1350, 3–4 slides each) and mix three looks:

- `concrete`: products on grey concrete, outlined brand and a big coloured title
- `studio`: light backdrop with a faint giant brand, black title and red measurement lines
- `color`: solid colour with the title repeated in outline behind the product

`feed/cutout.js` removes the white studio background from photos (cached in `feed/.build/cutouts/`).
Measurement lines can be placed relative to a photo (`{ img, from: [u, v], to: [u, v], offset }`) so they
follow its edges. The plan lives in `feed/schedule.js` (dates, kinds, tags, notes, source clips). Render the
board and get the owner's OK before scheduling.

### People and brands

| Handle | Notes |
|---|---|
| Team riders: @preamultmanual, @savos_tomas, @mxniliuc, @maxmaneee, @boroleanu_, @alecvladimir_ | The current team. @boroleanu_ was once captioned as "@bor0leanu" by mistake. |
| @cretutunoi | Leave out for now (owner's call) |
| @_edimot, @troznatamas, @p3thrash | In the page's Following list but inactive |
| @cyrilledissidence, @vitkovladislavvv, @mateiadrian._ | **No longer on the team.** Don't feature them as team riders. |
| @tiltlife | Tilt (**not** @tiltscooters) |
| @coreuk | Core Action Sports (found via ridecore.pro) |
| @pinnacleproscooters | Pinnacle |

The page's Following list also contains shops, parks and events, so not everyone there is a rider. Check
any new brand's handle by searching on Instagram before tagging.

## Business Suite playbooks

These were done by driving the owner's signed-in Chrome. The UI labels are Romanian.

**Feed post or image carousel**: Conținut → *Creează o postare*.

1. *Postează în*: untick the Facebook Page so it posts **only to Instagram**.
2. *Adaugă foto/video*: upload the JPEGs from `feed/out/<post>/`.
3. On image 1, open the tag icon → *Etichetează persoane*, click the image and pick the handle. Under
   *Etichetează produse*, turn off *Detectează și etichetează automat produse*. Save.
4. Leave *Text* empty. Turn on *Setează data și ora*, then set the date (`zz.ll.aaaa`), hour and minute.
5. Click *Programează*.

**Single vertical video (rider reel)**: the post composer rejects 9:16 ("Ajustează raportul de aspect",
which only allows 4:5–16:9). Use Conținut → *Creează un reel* instead:

1. Post to Instagram only, then *Adaugă un clip video*.
2. In *Descriere reel*, type only the @handle.
3. Click *Înainte*, choose *Programează*, then set the date and time (shown as Europe/Sofia, the same time
   as Bucharest).
4. Click *Programează*.

Optionally pick a cover frame from *Miniatură*.

**Video carousel**: use the post composer and upload several clips. Instagram crops them to one shape
automatically. The first file added often shows up twice, so delete the duplicate before scheduling. The
text is just the @handles.

**Stories with links**: in the story composer, post to Instagram only. *Adaugă un link* applies only to
Facebook, so add the link in the editor instead: *Mai multe stickere* → *Link*. Stickers are merged into the
image when applied, so position them carefully and check before applying.

**Upload size**: the browser automation could only pass files up to ~10 MB. Re-encode bigger clips with
`feed/shrink.swift` (720 px wide H.264, about 8 MB for a 40 s clip).

**Verify** everything under Conținut → *Postări și reel-uri* → *Programate*. The "Publică acum" button
in a post's details publishes immediately, so don't click it.

## Finding content on Instagram

- Who tagged the page: the page's **Tagged** tab, and Business Suite → *Menționări și etichete*, which also
  shows caption mentions.
- What was featured recently: the page's own grid. Captions name the riders.
- Instagram's private web endpoints rate-limit quickly (HTTP 429). Prefer the normal UI and keep API-style
  calls to a handful.
- A post's date can be read from its shortcode: base64url-decode it to the media ID, then
  `(id >> 23) + 1314220021721` is the time in milliseconds.
- Downloading riders' clips needs the owner's OK. Chrome allows one automatic download per page load, so
  reload between files. Save clips in `feed/clips/` (git-ignored).

## State as of early November 2026

- **Imported to Shopify** (active, on the Online Store): the Core SL3 range, Tilt's new collection
  (except stickers) and the Pinnacle range.
- **Stories**: 15 product stories went out 31 Oct–3 Nov (`stories/schedule.js`).
- **Feed**: 1–11 Nov are scheduled in Business Suite at 18:30, as in `feed/schedule.js`.
  **12 Nov** ("riders who tagged us") is still open. Pick riders who tagged the page from 1–11 Nov and
  haven't been featured.
