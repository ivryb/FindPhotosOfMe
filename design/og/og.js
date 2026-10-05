// Link preview (Open Graph) image options, 1200×630. Open index.html to compare them, or index.html?board=<id> for one
// board at full size, which is what render.sh screenshots. The site image is rendered once, so it can use any CSS;
// gallery images are made per gallery with Satori (nuxt-og-image), so those stick to flexbox and absolute positioning.

const PHOTO = (name) => `../../apps/web/public/landing/${name}.jpg`;
const LOGO = (name) => `../brand/svg/${name}.svg`;
const SITE = "findphotosofme.com";
const CAMERA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/></svg>`;

const LANDING = {
  title: "Find yourself in event photos",
  text: "Search thousands of event photos with a selfie.",
};
// The same attendee in every match, as on the landing page's search demo
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-05", "ev-06", "ev-07", "ev-08", "ev-04"];
const OTHERS = ["t01", "nx-04", "t03", "t05", "t18", "t02", "t30", "nx-01", "t04", "nx-02", "t07", "u03", "nx-05", "t10", "nx-03", "t12", "u04", "nx-06", "t13", "p09", "nx-07", "t16", "u05", "t17", "nx-08", "t19", "p11", "t21", "u06", "t24", "t25", "p20", "t28", "u08", "t29", "p26", "t31", "u31", "t34"];

// Two galleries: a typical one, and a long name with dark, busy photos to see where each layout breaks.
const EVENTS = [
  { title: "Makers Conf 2026", host: "makersconf", count: 5214, photos: ["nx-01", "ev-04", "nx-02", "nx-03", "t08", "nx-05"] },
  { title: "Neon Nights Festival at the Old Harbour 2026", host: "neonnights", count: 12860, photos: ["t15", "u29", "u33", "t14", "u13", "t13"] },
];

const count = (n) => n.toLocaleString("en-US");
// Satori can't shrink text to fit, so the title size steps down with its length.
const fit = (title, [large, medium, small]) => (title.length <= 18 ? large : title.length <= 30 ? medium : small);
const img = (name, extra = "") => `<img src="${PHOTO(name)}" alt="" ${extra}>`;

// A wall of event photos where only the attendee's own are lit; `slots` are the tiles that hold hers.
const wall = (size, slots) => {
  let other = 0;
  return Array.from({ length: size }, (_, i) => {
    const k = slots.indexOf(i);
    return k < 0 ? `<div class="tile">${img(OTHERS[other++ % OTHERS.length])}</div>` : `<div class="tile match">${img(MATCHES[k % MATCHES.length])}</div>`;
  }).join("");
};

const LANDING_BOARDS = [
  {
    id: "landing-rise",
    name: "Rising aperture",
    note: "The photo wall on top with her photos lit, the yellow band with the full-size headline below, and the aperture sitting across both with her selfie in its center.",
    render: () => `
      <div class="board l-rise">
        <div class="wall">${wall(30, [1, 4, 6, 12, 15, 20, 23])}</div>
        <div class="band">
          <h1>Find yourself<br>in event photos</h1>
          <p class="domain">FindPhotosOfMe.com</p>
        </div>
        <div class="disc"></div>
        <div class="eye">${img("face")}</div>
        <img class="mark" src="${LOGO("mark-yellow")}" alt="">
      </div>`,
  },
  {
    id: "landing-lens",
    name: "Lens",
    note: "The aperture cut out of her photos, in full color, with nothing else on them.",
    // The top row sits above the image edge, so only the lower three rows need to differ
    render: () => `
      <div class="board l-lens">
        <div class="lens">${["ev-08", "ev-04", "ev-06", "ev-02", "ev-03", "ev-06", "ev-05", "ev-01", "ev-04", "ev-07", "ev-08", "ev-03"].map((p) => img(p)).join("")}</div>
        <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
        <h1>Find yourself<br>in event photos</h1>
        <p>Search with a selfie. <span>${SITE}</span></p>
      </div>`,
  },
];

// Earlier site image versions, newest first, kept to compare against the current ones.
const EARLIER_BOARDS = [
  {
    id: "landing-rise-r3",
    name: "Rising aperture, round 3",
    note: "Full-size headline with the name above it.",
    render: () => `
      <div class="board l-rise r3">
        <div class="wall">${wall(30, [1, 4, 6, 12, 15, 20, 23])}</div>
        <div class="band">
          <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
          <h1>Find yourself<br>in event photos</h1>
        </div>
        <div class="disc"></div>
        <div class="eye">${img("face")}</div>
        <img class="mark" src="${LOGO("mark-yellow")}" alt="">
      </div>`,
  },
  {
    id: "landing-lens-r2",
    name: "Lens, round 2",
    note: "The aperture cut out of the whole photo wall, grey with her photos framed in yellow.",
    render: () => `
      <div class="board l-lens">
        <div class="lens wall r2">${wall(35, [6, 11, 13, 15, 20, 24, 27, 31])}</div>
        <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
        <h1>Find yourself<br>in event photos</h1>
        <p>Search with a selfie. <span>${SITE}</span></p>
      </div>`,
  },
  {
    id: "landing-rise-r2",
    name: "Rising aperture, round 2",
    note: "Taller photo wall, bigger aperture, smaller headline with the name above it.",
    render: () => `
      <div class="board l-rise r2">
        <div class="wall">${wall(40, [1, 4, 8, 12, 15, 21, 24, 33])}</div>
        <div class="band">
          <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
          <h1>${LANDING.title}</h1>
        </div>
        <div class="disc"></div>
        <div class="eye">${img("face")}</div>
        <img class="mark" src="${LOGO("mark-yellow")}" alt="">
      </div>`,
  },
  {
    id: "landing-center",
    name: "Center stage, round 2",
    note: "The logo and headline centered on the full wall, with her photos lit around the edges.",
    render: () => `
      <div class="board l-center">
        <div class="wall">${wall(70, [1, 6, 19, 20, 39, 50, 63, 68])}</div>
        <div class="stage">
          <img class="mark" src="${LOGO("mark-yellow")}" alt="">
          <h1>${LANDING.title}</h1>
          <p>Search thousands of photos with a selfie.</p>
        </div>
      </div>`,
  },
  {
    id: "landing-strip",
    name: "Aperture and strip, round 2",
    note: "The round 1 aperture image with a strip of the photo wall along the bottom.",
    render: () => `
      <div class="board l-strip">
        <img class="mark" src="${LOGO("mark-ink")}" alt="">
        <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
        <h1>Find yourself<br>in event photos</h1>
        <div class="strip wall">${wall(9, [2, 5])}</div>
      </div>`,
  },
  {
    id: "landing-found",
    name: "Found, round 1",
    note: "Yellow with the search result card hanging off the bottom edge.",
    render: () => `
      <div class="board l-found">
        <div class="copy">
          <img class="lockup" src="${LOGO("lockup-mono-ink")}" alt="">
          <h1>${LANDING.title}</h1>
          <p>${LANDING.text}</p>
        </div>
        <div class="screen">
          <div class="bar">
            <div class="bar-text"><b>8 photos of you</b><span>out of 5,214</span></div>
            <div class="selfie"><span>Your photo</span>${img("face")}</div>
          </div>
          <div class="results">${MATCHES.map((m) => `<div class="cell">${img(m)}</div>`).join("")}</div>
        </div>
      </div>`,
  },
  {
    id: "landing-pile",
    name: "The pile, round 1",
    note: "Dimmed photos with hers lit in yellow, a yellow band with the headline, and her selfie on the edge.",
    render: () => `
      <div class="board l-pile">
        <div class="pile">${wall(40, [3, 8, 13, 21, 26, 30, 37])}</div>
        <div class="band">
          <div class="band-copy"><h1>${LANDING.title}</h1><p>${LANDING.text}</p></div>
          <div class="face">${img("face")}</div>
        </div>
      </div>`,
  },
  {
    id: "landing-aperture",
    name: "Aperture, round 1",
    note: "Type and the logo mark only.",
    render: () => `
      <div class="board l-aperture">
        <img class="mark" src="${LOGO("mark-ink")}" alt="">
        <img class="lockup" src="${LOGO("wordmark-ink")}" alt="">
        <h1>Find yourself<br>in event photos</h1>
        <p>Search with a selfie. <span>${SITE}</span></p>
      </div>`,
  },
  {
    id: "landing-spotted",
    name: "Spotted, round 1",
    note: "A real crowd with her face circled and matched to her selfie.",
    render: () => `
      <div class="board l-spotted">
        ${img("ev-01", 'class="crowd"')}
        <div class="ring"></div>
        <div class="tag">${img("face")}<span>Matches your selfie</span></div>
        <div class="shade">
          <h1>${LANDING.title}</h1>
          <div class="shade-side"><img class="lockup" src="${LOGO("lockup-white")}" alt=""><p>${LANDING.text}</p></div>
        </div>
      </div>`,
  },
];

const EVENT_BOARDS = [
  {
    id: "event-page",
    name: "Gallery page",
    note: "Ink, like the gallery page itself, with its yellow search bar. Visitors who tap through land somewhere that looks the same.",
    render: (e) => `
      <div class="board e-page">
        <div class="copy">
          <img class="lockup" src="${LOGO("lockup-white")}" alt="">
          <h1 style="font-size:${fit(e.title, [84, 70, 56])}px">${e.title}</h1>
          <p class="count"><b>${count(e.count)} photos</b></p>
          <div class="search">${CAMERA}<span>Find your photos with a selfie</span></div>
        </div>
        <div class="grid">
          <div class="col">${img(e.photos[0])}${img(e.photos[1])}${img(e.photos[2])}</div>
          <div class="col down">${img(e.photos[3])}${img(e.photos[4])}</div>
        </div>
      </div>`,
  },
  {
    id: "event-cover",
    name: "Cover",
    note: "Photos fill the whole image and a yellow card sits on top. The most striking when the first previews are good, and the most at their mercy.",
    render: (e) => `
      <div class="board e-cover">
        <div class="mosaic">
          <div class="big">${img(e.photos[0])}</div>
          <div class="side">${img(e.photos[1])}${img(e.photos[2])}</div>
        </div>
        <div class="card">
          <h1 style="font-size:${fit(e.title, [76, 62, 50])}px">${e.title}</h1>
          <p><b>${count(e.count)} photos.</b> Find yours with a selfie.</p>
          <img class="lockup" src="${LOGO("lockup-mono-ink")}" alt="">
        </div>
      </div>`,
  },
  {
    id: "event-prints",
    name: "Prints",
    note: "Yellow with three photos as fanned prints. Warm and personal, and still works when a gallery has a single preview.",
    render: (e) => `
      <div class="board e-prints">
        <div class="copy">
          <img class="lockup" src="${LOGO("lockup-mono-ink")}" alt="">
          <h1 style="font-size:${fit(e.title, [80, 66, 52])}px">${e.title}</h1>
          <p><b>${count(e.count)} photos.</b><br>Find yours with a selfie.</p>
        </div>
        <div class="fan">
          <div class="print p1">${img(e.photos[2])}</div>
          <div class="print p2">${img(e.photos[1])}</div>
          <div class="print p3">${img(e.photos[0])}</div>
        </div>
      </div>`,
  },
  {
    id: "event-question",
    name: "Were you there?",
    note: "Asks the question people actually have when a link lands in a group chat. White page, photos as a strip along the bottom.",
    render: (e) => `
      <div class="board e-question">
        <img class="lockup" src="${LOGO("lockup-ink")}" alt="">
        <h1 style="font-size:${fit(e.title, [78, 66, 54])}px">Were you at ${e.title}?</h1>
        <div class="search">${CAMERA}<span>Find your photos with a selfie</span></div>
        <div class="strip">${e.photos.slice(0, 5).map((p) => `<div class="frame">${img(p)}</div>`).join("")}</div>
      </div>`,
  },
];

const ALL = [...[...LANDING_BOARDS, ...EARLIER_BOARDS].map((b) => ({ ...b, html: b.render() })), ...EVENT_BOARDS.flatMap((b) => EVENTS.map((e, i) => ({ ...b, id: `${b.id}-${i + 1}`, html: b.render(e) })))];

const only = new URLSearchParams(location.search).get("board");
if (only) {
  document.body.className = "single";
  document.body.innerHTML = ALL.find((b) => b.id === only)?.html ?? "Unknown board";
} else {
  const section = (title, intro, boards, pairs) => `
    <section>
      <h2>${title}</h2>
      <p class="intro">${intro}</p>
      ${boards.map((b) => `
        <article>
          <h3>${b.name}</h3>
          <p>${b.note}</p>
          <div class="row">${(pairs ? EVENTS.map((e) => b.render(e)) : [b.render()]).map((h) => `<div class="frame-view">${h}</div>`).join("")}</div>
        </article>`).join("")}
    </section>`;
  document.getElementById("options").innerHTML =
    section("Site pages", "One image for the landing pages, rendered once; each audience page can swap in its own headline.", LANDING_BOARDS, false) +
    section("Event galleries", "Made for each gallery from its name, photo count, and first previews. Each is shown with a short name and a long one.", EVENT_BOARDS, true) +
    section("Earlier site images", "Previous rounds, newest first.", EARLIER_BOARDS, false);
}
