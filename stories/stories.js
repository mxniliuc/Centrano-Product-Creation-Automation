// stories/stories.js
// One entry per Instagram story (1080x1920). Coordinates are pixels on the story.
//
//   brand / title / subtitle   the three header lines
//   badge     { price, from? }  red price starburst ("from" adds e.g. "DE LA" above the price)
//   images    [{ src, x, y, width, rotate }]  product photos (white background), centred on x/y
//   labels    [{ text, x, y, rotate, size }]  text along a product, e.g. colour names
//   dims      [{ text, x1, y1, x2, y2, color, textOffset }]  measurement arrows

module.exports = [
  {
    slug: "tilt-nikita",
    brand: "TILT",
    title: "NIKITA DECK",
    subtitle: "MIDNIGHT",
    badge: { price: "1244.99" },
    images: [{ src: "stories/assets/tilt-nikita-top.jpg", x: 540, y: 1540, width: 1040, rotate: 0 }],
    dims: [
      // along the deck's top edge, and across the deck face near the rear
      { text: "59.7cm / 23.5\"", x1: 278, y1: 1413, x2: 1036, y2: 1255 },
      { text: "6.5\"", x1: 896, y1: 1370, x2: 873, y2: 1583, color: "#fff", textX: 940, textY: 1530, textAngle: 0, size: 40 },
    ],
  },
  {
    slug: "tilt-formula-reaper",
    brand: "TILT",
    title: "FORMULA REAPER DECK",
    subtitle: "7.0\" × 23.0\"",
    badge: { price: "1194.99" },
    images: [{ src: "stories/assets/tilt-formula-reaper-top.jpg", x: 520, y: 1440, width: 1260, rotate: -24 }],
  },
  {
    slug: "tilt-durare-barbed",
    brand: "TILT",
    title: "DURARE BARBED WHEELS",
    subtitle: "NEW COLORWAYS",
    badge: { price: "424.99", from: "DE LA" },
    images: [
      { src: "stories/assets/tilt-durare-barbed-crimson.jpg", x: 300, y: 1000, width: 450 },
      { src: "stories/assets/tilt-durare-barbed-black.jpg", x: 560, y: 1360, width: 450 },
      { src: "stories/assets/tilt-durare-barbed-forest.jpg", x: 830, y: 1700, width: 480 },
    ],
    labels: [
      { text: "CRIMSON · 110MM", x: 60, y: 1730, size: 44, align: "left" },
      { text: "BLACK · 110MM", x: 60, y: 1797, size: 44, align: "left" },
      { text: "FOREST · 120MM", x: 60, y: 1864, size: 44, align: "left" },
    ],
  },
  {
    slug: "core-sl3",
    brand: "CORE",
    title: "SL3 COMPLETE",
    subtitle: "3 COLORWAYS",
    badge: { price: "1384.99" },
    images: [
      { src: "stories/assets/core-sl3-black-side.jpg", x: 240, y: 1110, width: 420 },
      { src: "stories/assets/core-sl3-chrome-teal-side.jpg", x: 520, y: 1330, width: 480 },
      { src: "stories/assets/core-sl3-red-side.jpg", x: 815, y: 1500, width: 410 },
    ],
    labels: [
      { text: "BLACK", x: 60, y: 1745, size: 44, align: "left" },
      { text: "CHROME / TEAL", x: 60, y: 1810, size: 44, align: "left" },
      { text: "RED", x: 60, y: 1875, size: 44, align: "left" },
    ],
  },
  {
    slug: "core-sl3-mini",
    brand: "CORE",
    title: "SL3 MINI COMPLETE",
    subtitle: "3 COLORWAYS",
    badge: { price: "1384.99" },
    // same height for all three (the photos have different shapes)
    images: [
      { src: "stories/assets/core-sl3-mini-black-side.jpg", x: 240, y: 1090, width: 440 },
      { src: "stories/assets/core-sl3-mini-chrome-teal-side.jpg", x: 560, y: 1300, width: 616 },
      { src: "stories/assets/core-sl3-mini-red-side.jpg", x: 830, y: 1490, width: 608 },
    ],
    labels: [
      { text: "BLACK", x: 60, y: 1745, size: 44, align: "left" },
      { text: "CHROME / TEAL", x: 60, y: 1810, size: 44, align: "left" },
      { text: "RED", x: 60, y: 1875, size: 44, align: "left" },
    ],
  },
  {
    slug: "core-sl3-6-forged",
    brand: "CORE",
    title: "SL3 6\" FORGED DECK",
    subtitle: "21\" · 3 COLORWAYS",
    badge: { price: "824.99" },
    images: [
      // parallel decks 400px apart, each colour name in the gap above its deck (like the Aztek story)
      { src: "stories/assets/core-sl3-6-black-top.jpg", x: 300, y: 1230, width: 1200, rotate: -50 },
      { src: "stories/assets/core-sl3-6-red-top.jpg", x: 606, y: 1487, width: 1200, rotate: -50 },
      { src: "stories/assets/core-sl3-6-polished-top.jpg", x: 913, y: 1744, width: 1200, rotate: -50 },
    ],
    labels: [
      { text: "BLACK", x: 221, y: 1033, size: 56, rotate: -50 },
      { text: "RED", x: 527, y: 1290, size: 56, rotate: -50 },
      { text: "POLISHED", x: 834, y: 1547, size: 56, rotate: -50 },
    ],
  },
  {
    slug: "core-sl3-sponseller",
    brand: "CORE",
    title: "SL3 SIGNATURE DECK",
    subtitle: "COREY SPONSELLER",
    badge: { price: "824.99" },
    images: [{ src: "stories/assets/core-sl3-sponseller.jpg", x: 540, y: 1430, width: 1200, rotate: -14 }],
  },
  {
    slug: "core-sl3-tang",
    brand: "CORE",
    title: "SL3 SIGNATURE DECK",
    subtitle: "BRANDON TANG · 19.3\"",
    badge: { price: "824.99" },
    images: [{ src: "stories/assets/core-sl3-tang.jpg", x: 540, y: 1430, width: 1200, rotate: -14 }],
  },
  {
    slug: "tilt-miller",
    brand: "TILT",
    title: "MILLER 6.5\" DECK",
    subtitle: "POLISHED",
    badge: { price: "1194.99" },
    images: [{ src: "stories/assets/tilt-miller-top.jpg", x: 540, y: 1540, width: 1040, rotate: 0 }],
    dims: [
      { text: "22\" / 23\"", x1: 310, y1: 1411, x2: 1027, y2: 1257 },
      { text: "6.5\"", x1: 901, y1: 1372, x2: 888, y2: 1590, textX: 815, textY: 1485, textAngle: 0, size: 40 },
    ],
  },
  {
    slug: "tilt-eden-gagliano-wheels",
    brand: "TILT",
    title: "EDEN GAGLIANO WHEELS",
    subtitle: "RAW · 110MM · 88A",
    badge: { price: "449.99" },
    images: [{ src: "stories/assets/tilt-eden-gagliano-wheels.jpg", x: 450, y: 1480, width: 780 }],
  },
  {
    slug: "tilt-gagliano-bars",
    brand: "TILT",
    title: "STAGE I GAGLIANO BARS",
    subtitle: "710MM × 610MM",
    badge: { price: "524.99" },
    images: [{ src: "stories/assets/tilt-gagliano-bars-front.jpg", x: 520, y: 1480, width: 1500, rotate: -25 }],
  },
  {
    slug: "tilt-griptape",
    brand: "TILT",
    title: "GRIPTAPE",
    subtitle: "5 NEW DESIGNS",
    badge: { price: "59.99" },
    images: [
      { src: "stories/assets/tilt-grip-neo-strip.jpg", x: 130, y: 1290, width: 190, rotate: -25 },
      { src: "stories/assets/tilt-grip-knockout.jpg", x: 330, y: 1380, width: 175, rotate: -25 },
      { src: "stories/assets/tilt-grip-inked-logo.jpg", x: 530, y: 1470, width: 175, rotate: -25 },
      { src: "stories/assets/tilt-grip-cenobite.jpg", x: 730, y: 1560, width: 175, rotate: -25 },
      { src: "stories/assets/tilt-grip-puncture.jpg", x: 930, y: 1650, width: 175, rotate: -25 },
    ],
    labels: [
      { text: "NEO", x: 50, y: 1650, size: 40, align: "left" },
      { text: "KNOCKOUT", x: 50, y: 1708, size: 40, align: "left" },
      { text: "INKED LOGO", x: 50, y: 1766, size: 40, align: "left" },
      { text: "CENOBITE GLOW", x: 50, y: 1824, size: 40, align: "left" },
      { text: "PUNCTURE", x: 50, y: 1882, size: 40, align: "left" },
    ],
  },
];
