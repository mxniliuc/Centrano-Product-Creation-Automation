// feed/schedule.js
// Instagram feed plan: one post a day, repeating team rider -> product -> riders who tagged us.
// Picks favour riders/products that haven't been on the feed recently (checked 1 Nov 2026).
// No captions: product posts tag the brand on the cover image; rider posts have only the @handles as text
// (Business Suite can't tag people on videos). Clips come from each rider's post that tags us, see `clip(s)`.
// 1–11 Nov are scheduled in Business Suite; 12 Nov still needs its riders picked.
// Render the overview with:  node feed/board.js  ->  feed/out/feed-schedule.png

module.exports = {
  time: "18:30", // same slot as the page's last feed post (Sequel drop, 13 Sep)
  posts: [
    // ---- cycle 1
    {
      date: "2026-11-01", kind: "team", tags: ["preamultmanual"], name: "Gabor Viktor-Tamas",
      note: "Very active: 8 tags in the last 9 weeks. Last on the feed 45 posts ago.",
      content: "His latest #ohlaytrickoftheyear2026 entry (29 Oct)",
      clip: "preamultmanual/reel/DfFcKDkICmP",
    },
    {
      date: "2026-11-02", kind: "product", post: "tilt-decks", tags: ["tiltlife"], title: "Tilt Nikita · Formula Reaper · Miller decks",
      note: "New Tilt collection, none of it on the feed yet.",
    },
    {
      date: "2026-11-03", kind: "tagged", tags: ["ssabins13", "its.muhiki", "jew1sk0", "fatyol.d"],
      clips: ["DecWr3giAYN", "Deqvz04I7tU", "DeY2eHqovf5", "DexIUKske2g"],
      note: "The most active taggers that have never been featured.",
    },
    // ---- cycle 2
    {
      date: "2026-11-04", kind: "team", tags: ["savos_tomas"],
      note: "Last on the feed 9 posts ago (12 by this date). Only photos since March, so his newest reel.",
      content: "His 21 Mar reel (tags us)",
      clip: "savos_tomas/reel/DWI7g3TCLRu",
    },
    {
      date: "2026-11-05", kind: "product", post: "core-sl3-signature", tags: ["coreuk"], title: "Core SL3 signature decks · pre-order",
      note: "Corey Sponseller and Brandon Tang decks.",
    },
    {
      date: "2026-11-06", kind: "tagged", tags: ["14.calinn_scoot", "soare_scoot", "levibruuh", "18.mario.99", "b_doma13"],
      clips: ["DeE6cVKqmCj", "Ddez8qZANQY", "DdmOPpAiqL1", "Dco4JHXkRfE", "Dem_b9esJBT"],
      note: "Tagged us in the last 2–9 weeks, never featured.",
    },
    // ---- cycle 3
    {
      date: "2026-11-07", kind: "team", tags: ["mxniliuc"],
      note: "Last on the feed 8 posts ago (14 by this date). Posted 25 Oct.",
      content: "His latest clip (25 Oct, tags us)",
      clip: "mxniliuc/reel/De6_GcnqYMO",
    },
    {
      date: "2026-11-08", kind: "product", post: "pinnacle-staple", tags: ["pinnacleproscooters"], title: "Pinnacle Staple decks + Y bars · pre-order",
      note: "New brand in the shop.",
    },
    {
      date: "2026-11-09", kind: "tagged", tags: ["yeahgeorgee", "dominick_scoot5", "met__0d", "_rogalik____"],
      clips: ["DcnzsouIolN", "DfMed6xDcGY", "DcYzBk7qKi5", "DeHKIXbMPDN"],
      note: "dominick_scoot5 tags us every week (11 tags); the rest are new.",
    },
    // ---- cycle 4
    {
      date: "2026-11-10", kind: "team", tags: ["maxmaneee"],
      note: "Last on the feed 3 posts ago (12 by this date). Posts weekly, latest 31 Oct.",
      content: "\"Junior 🤝 Senior\" (31 Oct)",
      clip: "maxmaneee/reel/DfJ2Frisp0O",
    },
    {
      date: "2026-11-11", kind: "product", post: "tilt-wheels", tags: ["tiltlife"], title: "Tilt Durare Barbed + Eden Gagliano wheels",
      note: "Mix & match of the new Tilt wheels.",
    },
    {
      date: "2026-11-12", kind: "tagged", tags: [], placeholder: "new tags from 1–11 Nov",
      note: "Pick the best fresh tags on the day so it stays current.",
    },
  ],
  // Not scheduled this round, and why
  skipped: {
    "cyrilledissidence, vitkovladislavvv, mateiadrian._": "no longer on the team",
    "cretutunoi": "not this round",
    "boroleanu_": "featured 2 posts ago (active, next in line)",
    "alecvladimir_": "featured 5 posts ago, nothing new since May",
    "_edimot": "no posts since Dec 2023",
    "troznatamas": "no posts on the profile",
    "p3thrash": "newest visible post is from Sep 2024",
  },
};
