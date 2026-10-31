// stories/schedule.js
// When each story goes out (Romania time). Render an overview image with:
//   node stories/board.js   ->  stories/out/schedule.png

module.exports = {
  timezone: "Europe/Bucharest",
  days: [
    {
      date: "2026-10-31",
      theme: "Pinnacle · pre-order · posted right away",
      posts: [
        { time: "now", slug: "pinnacle-staple-55" },
        { time: "now", slug: "pinnacle-staple-49" },
        { time: "now", slug: "pinnacle-staple-bars" },
      ],
    },
    {
      date: "2026-11-01",
      theme: "Core SL3 · pre-order decks + completes",
      posts: [
        { time: "18:00", slug: "core-sl3-6-forged" },
        { time: "18:30", slug: "core-sl3-sponseller" },
        { time: "19:00", slug: "core-sl3-tang" },
        { time: "19:30", slug: "core-sl3" },
        { time: "20:00", slug: "core-sl3-mini" },
      ],
    },
    {
      date: "2026-11-02",
      theme: "Tilt · decks + griptape",
      posts: [
        { time: "18:00", slug: "tilt-nikita" },
        { time: "18:40", slug: "tilt-formula-reaper" },
        { time: "19:20", slug: "tilt-miller" },
        { time: "20:00", slug: "tilt-griptape" },
      ],
    },
    {
      date: "2026-11-03",
      theme: "Tilt · wheels + bars",
      posts: [
        { time: "18:00", slug: "tilt-durare-barbed" },
        { time: "19:00", slug: "tilt-eden-gagliano-wheels" },
        { time: "20:00", slug: "tilt-gagliano-bars" },
      ],
    },
  ],
};
