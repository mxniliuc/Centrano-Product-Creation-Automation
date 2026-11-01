// feed/posts.js
// Product carousels for the feed (1080x1350). Render with:  node feed/render.js
//
// Each slide picks one of three looks, mixed across a carousel:
//   concrete  photos laid on grey concrete, outlined brand + big coloured title (lifestyle feel)
//   studio    light backdrop, giant faint brand watermark, black title, red measurement lines (spec sheet)
//   color     solid colour backdrop with the title repeated in outline behind the product
//
// Slide fields:
//   brand / title / kicker   top lines (small brand, big title, spaced line under it)
//   accent                   title colour (concrete), brand colour (studio), backdrop (color; bg/bg2 override)
//   tag                      e.g. "PRE-ORDER" pill, or { text, x, y, rotate }
//   images  [{ src, x, y, width, rotate, crop: [top, bottom], z }]  product photo centred on x/y; background removed
//   dims    [{ text, x1, y1, x2, y2, textX, textY, textAngle, textOffset, size }]  measurement lines
//   labels  [{ text, x, y, rotate, size, align }]

const A = name => `stories/assets/${name}.jpg`;
const PRE = "PRE-ORDER";
const PURPLE = "#8a4dff";

module.exports = [
  {
    slug: "tilt-decks",
    slides: [
      {
        style: "concrete", brand: "TILT", title: "NEW DECKS", kicker: "NIKITA · FORMULA REAPER · MILLER",
        images: [
          { src: A("tilt-miller-top"), x: 470, y: 720, width: 780, rotate: -24 },
          { src: A("tilt-formula-reaper-top"), x: 560, y: 890, width: 780, rotate: -24 },
          { src: A("tilt-nikita-top"), x: 650, y: 1060, width: 780, rotate: -24 },
        ],
      },
      {
        style: "studio", brand: "TILT", title: "NIKITA", kicker: "DECK · 6.5\" · MIDNIGHT",
        images: [{ src: A("tilt-nikita-top"), x: 520, y: 850, width: 1000 }],
        // along the deck's far edge
        dims: [{ img: 0, from: [0.27, 0.355], to: [0.985, 0.0], offset: -40, text: "59.7 CM / 23.5\"" }],
      },
      {
        style: "color", accent: "#b40d14", bg2: "#e0121b", brand: "TILT", title: "FORMULA REAPER", kicker: "DECK · 7.0\" × 23.0\"",
        watermark: "REAPER",
        images: [{ src: A("tilt-formula-reaper-top"), x: 540, y: 900, width: 1050, rotate: -20 }],
      },
      {
        style: "studio", brand: "TILT", title: "MILLER", kicker: "DECK · 6.5\" · POLISHED",
        images: [{ src: A("tilt-miller-top"), x: 520, y: 850, width: 1000 }],
        dims: [{ img: 0, from: [0.27, 0.345], to: [0.985, 0.0], offset: -40, text: "22\" / 23\" LONG" }],
      },
    ],
  },
  {
    slug: "core-sl3-signature",
    slides: [
      {
        style: "concrete", accent: "#21c4ea", brand: "CORE", title: "SL3 SIGNATURE", kicker: "SPONSELLER · TANG", tag: PRE,
        images: [
          { src: A("core-sl3-sponseller"), crop: [0.55, 1], x: 540, y: 700, width: 1000, rotate: -14 },
          { src: A("core-sl3-tang"), crop: [0.55, 1], x: 540, y: 1010, width: 1000, rotate: -14 },
        ],
      },
      {
        style: "studio", accent: "#21a9d6", brand: "CORE", title: "SPONSELLER", kicker: "SL3 SIGNATURE DECK", tag: { text: PRE, y: 1228 },
        images: [{ src: A("core-sl3-sponseller"), x: 540, y: 780, width: 960 }],
        dims: [{ img: 0, from: [0.0, 1.0], to: [1.0, 1.0], offset: 40, textOffset: 42, text: "5.25\" × 20\" / 13.3 × 50.8 CM" }],
      },
      {
        style: "color", accent: "#a3136a", bg2: "#e3409b", brand: "CORE", title: "BRANDON TANG", kicker: "SL3 SIGNATURE DECK", tag: { text: PRE, y: 1228 },
        watermark: "TANG",
        images: [{ src: A("core-sl3-tang"), x: 540, y: 780, width: 960 }],
        dims: [{ img: 0, from: [0.0, 1.0], to: [1.0, 1.0], offset: 40, textOffset: 42, color: "#fff", text: "5.25\" × 19.3\" / 13.3 × 49 CM" }],
      },
    ],
  },
  {
    slug: "pinnacle-staple",
    slides: [
      {
        style: "studio", accent: PURPLE, brand: "PINNACLE", title: "STAPLE", kicker: "NEW DECKS · 4.9\" & 5.5\"", tag: { text: PRE, x: 56, y: 1240 }, foot: false,
        images: [
          { src: A("pinnacle-staple-55-top"), x: 270, y: 980, width: 1000, rotate: -90 },
          { src: A("pinnacle-staple-49-black-top"), x: 540, y: 1017, width: 925, rotate: -90 },
          { src: A("pinnacle-staple-49-sharman-top"), x: 810, y: 1017, width: 925, rotate: -90 },
        ],
        dims: [
          { text: "5.5\"", x1: 160, y1: 455, x2: 380, y2: 455 },
          { text: "4.9\"", x1: 440, y1: 530, x2: 640, y2: 530 },
          { text: "4.9\"", x1: 710, y1: 530, x2: 910, y2: 530 },
          { text: "20\" / 50.8 CM", x1: 122, y1: 480, x2: 122, y2: 1350, textX: 88, textY: 760, textAngle: -90, size: 34 },
          { text: "18.5\" / 47 CM", x1: 958, y1: 555, x2: 958, y2: 1350, textX: 992, textY: 820, textAngle: -90, size: 34 },
        ],
      },
      {
        style: "concrete", accent: PURPLE, brand: "PINNACLE", title: "STAPLE 5.5\"", kicker: "JAYDEN SHARMAN", tag: PRE,
        images: [{ src: A("pinnacle-staple-55-top"), x: 540, y: 860, width: 1150, rotate: -24 }],
      },
      {
        style: "color", accent: "#4b1aa8", bg2: "#7b3cf0", brand: "PINNACLE", title: "STAPLE 4.9\"", kicker: "BLACK · JAYDEN SHARMAN", tag: PRE,
        watermark: "STAPLE",
        images: [
          { src: A("pinnacle-staple-49-black-top"), x: 470, y: 740, width: 950, rotate: -30 },
          { src: A("pinnacle-staple-49-sharman-top"), x: 610, y: 990, width: 950, rotate: -30 },
        ],
      },
      {
        style: "concrete", accent: PURPLE, brand: "PINNACLE", title: "Y BARS", kicker: "STAPLE CHROMOLY · 620 / 660 MM", tag: PRE,
        images: [{ src: A("pinnacle-staple-bars"), x: 540, y: 840, width: 860, rotate: -8 }],
      },
    ],
  },
  {
    slug: "tilt-wheels",
    slides: [
      {
        style: "concrete", accent: "#e3231b", brand: "TILT", title: "NEW WHEELS", kicker: "DURARE BARBED · EDEN GAGLIANO",
        images: [
          { src: A("tilt-durare-barbed-crimson"), x: 320, y: 650, width: 380 },
          { src: A("tilt-durare-barbed-forest"), x: 760, y: 650, width: 380 },
          { src: A("tilt-durare-barbed-black"), x: 320, y: 1040, width: 380 },
          { src: A("tilt-eden-gagliano-wheels"), x: 760, y: 1040, width: 380 },
        ],
      },
      {
        style: "color", accent: "#1c1c1c", bg2: "#4a4a4a", brand: "TILT", title: "DURARE BARBED", kicker: "110 / 120 MM",
        watermark: "BARBED",
        images: [
          { src: A("tilt-durare-barbed-crimson"), x: 200, y: 860, width: 340 },
          { src: A("tilt-durare-barbed-black"), x: 540, y: 860, width: 340 },
          { src: A("tilt-durare-barbed-forest"), x: 880, y: 860, width: 340 },
        ],
        labels: [
          { text: "CRIMSON", x: 200, y: 1140, size: 36 },
          { text: "BLACK", x: 540, y: 1140, size: 36 },
          { text: "FOREST", x: 880, y: 1140, size: 36 },
        ],
      },
      {
        style: "studio", brand: "TILT", title: "EDEN GAGLIANO", kicker: "RAW · 110 MM · 88A",
        images: [{ src: A("tilt-eden-gagliano-wheels"), x: 540, y: 890, width: 620 }],
        dims: [{ img: 0, from: [0.0, 0.0], to: [1.0, 0.0], offset: -30, text: "110 MM" }],
      },
    ],
  },
];
