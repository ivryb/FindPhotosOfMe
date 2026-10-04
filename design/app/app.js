// Shared sample data, icons, the prototype state strip, and a simulated selfie search.

const photo = (name) => `../landing-v2/assets/${name}.jpg`;
const fmt = (n) => n.toLocaleString("en-US");

const EVENT = {
  title: "Harbor Summit Lisbon",
  total: 5214,
  description: "Photos from both days of Harbor Summit, May 14 and 15 at the Lisbon Congress Centre. Taken by Lumen Studio.",
  link: "harborsummit.findphotosofme.com",
};

const PREVIEWS = [
  "nx-01", "t01", "nx-02", "u03", "t02", "nx-03", "t03", "u04", "t04", "nx-04", "t05", "u05",
  "t06", "nx-05", "t07", "u06", "t08", "nx-06", "t09", "u08", "t10", "nx-07", "t11", "u13",
  "t12", "nx-08", "t13", "u14", "t14", "t15", "u29", "t16", "t17", "u31", "t18", "t19",
  "u32", "t20", "t21", "u33", "t22", "t23", "u43", "t24", "t25", "t26", "t27", "t28",
];
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-04", "ev-05", "ev-06", "ev-07", "ev-08"];

// One organizer's events. `processing` is the ZIP being read right now.
const EVENTS = [
  {
    id: "harbor", name: "Harbor Summit Lisbon", link: "harborsummit.findphotosofme.com",
    covers: ["nx-01", "nx-04", "nx-07", "t21"], ready: 3920, processing: { done: 640, total: 1294 },
    limit: 6000, searches: 214, searchLimit: 600, plan: "paid", until: "Nov 13",
    description: EVENT.description,
    uploads: [
      { file: "day-1-morning.zip", size: "1.4 GB", state: "ready", photos: 1310 },
      { file: "day-1-afternoon.zip", size: "1.3 GB", state: "ready", photos: 1290 },
      { file: "day-2-morning.zip", size: "1.4 GB", state: "ready", photos: 1320 },
      { file: "day-2-afternoon.zip", size: "1.2 GB", state: "busy", done: 640, photos: 1294 },
      { file: "speakers-extra.zip", size: "380 MB", state: "bad", error: "This ZIP couldn’t be opened. It may be damaged. Upload it again." },
    ],
  },
  {
    id: "race", name: "City half marathon", link: "cityhalf.findphotosofme.com",
    covers: ["case-race"], ready: 12180, processing: { done: 2050, total: 6240 },
    limit: 20000, searches: 0, searchLimit: 2000, plan: "paid", until: "Dec 31",
    description: "Finish line and course photos from the City half marathon.",
    uploads: [
      { file: "start-and-km5.zip", size: "1.9 GB", state: "ready", photos: 6020 },
      { file: "km10-km15.zip", size: "1.9 GB", state: "ready", photos: 6160 },
      { file: "finish-line.zip", size: "2.0 GB", state: "busy", done: 2050, photos: 6240 },
    ],
  },
  {
    id: "wedding", name: "Marta and Joon’s wedding", link: "marta-joon.findphotosofme.com",
    covers: ["case-wedding"], ready: 1860, processing: null,
    limit: 2000, searches: 96, searchLimit: 300, plan: "paid", until: "Nov 1",
    description: "Ceremony and party photos. Thank you for celebrating with us.",
    uploads: [{ file: "wedding-full.zip", size: "1.6 GB", state: "ready", photos: 1860 }],
  },
  {
    id: "offsite", name: "Northwind team offsite", link: "northwind.findphotosofme.com",
    covers: ["p20", "p02", "p30", "p11"], ready: 412, processing: null,
    limit: 500, searches: 18, searchLimit: 50, plan: "trial", until: "Oct 9",
    description: "Photos from the September offsite in Sintra.",
    uploads: [{ file: "offsite.zip", size: "640 MB", state: "ready", photos: 412 }],
  },
  {
    id: "launch", name: "Rooftop launch party", link: "rooftop-launch.findphotosofme.com",
    covers: [], ready: 0, processing: null,
    limit: 500, searches: 0, searchLimit: 50, plan: "trial", until: "Oct 11",
    description: "", uploads: [],
  },
];

const STATUS = {
  ready: { label: "Ready", tone: "" },
  busy: { label: "Finding faces", tone: "busy" },
  empty: { label: "No photos yet", tone: "idle" },
};
const statusOf = (event) => (event.processing ? STATUS.busy : event.ready ? STATUS.ready : STATUS.empty);
const pill = (status) => `<span class="pill ${status.tone}">${status.label}</span>`;

const ICONS = {
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  open: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  retry: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach((el) => el.outerHTML = icon(el.dataset.icon));
}

// The grey strip above each prototype. Returns a function that marks the current state.
function protoBar(label, states, onPick) {
  const bar = document.createElement("div");
  bar.className = "proto";
  bar.innerHTML = `<a href="index.html">All variations</a><span>${label}</span>` +
    states.map(([id, text]) => `<button type="button" data-state="${id}" aria-pressed="false">${text}</button>`).join("");
  bar.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (button) onPick(button.dataset.state);
  });
  document.body.prepend(bar);
  return (state) => bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === state)));
}

// The attendee's search: start → selfie → searching → found | none | error.
// `render` gets the whole state on every change and is the only thing that touches the page.
function createSearch(render, { ms: duration = 4600 } = {}) {
  const s = { state: "start", selfie: null, checked: 0, found: 0 };
  let timer;
  const set = (state, patch = {}) => {
    clearInterval(timer);
    Object.assign(s, patch, { state });
    document.body.dataset.state = state;
    render(s);
  };
  const search = () => {
    set("searching", { checked: 0, found: 0, selfie: s.selfie ?? photo("face") });
    const start = performance.now();
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 600 : duration;
    timer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      s.checked = Math.round(EVENT.total * t);
      s.found = Math.floor(MATCHES.length * Math.min(1, t * 1.15));
      render(s);
      if (t === 1) set("found");
    }, 70);
  };
  const jump = (state) => {
    if (state === "searching") return search();
    const selfie = state === "start" ? null : s.selfie ?? photo("face");
    set(state, { selfie, checked: EVENT.total, found: state === "found" ? MATCHES.length : 0 });
  };
  const pickFile = (input) => {
    const file = input.files?.[0];
    if (file) set("selfie", { selfie: URL.createObjectURL(file) });
    input.value = "";
  };
  set("start");
  return { s, search, jump, pickFile, reset: () => set("start", { selfie: null }) };
}

const SEARCH_STATES = [["start", "Start"], ["selfie", "Selfie added"], ["searching", "Searching"], ["found", "Found"], ["none", "No matches"], ["error", "No face"]];

const matchTiles = () => MATCHES.map((name, i) =>
  `<li style="--i:${i}"><a href="${photo(name)}" download aria-label="Download photo ${i + 1}"><img src="${photo(name)}" alt="Photo ${i + 1} of you"><span>${icon("download")}</span></a></li>`).join("");

// ---- Dashboard parts ----

const spaceUsed = (event) => event.ready + (event.processing?.total ?? 0);
const slug = (name) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// What each limit looks like right now, for the plan panel
const usage = (event) => [
  { label: "Photos", value: `${fmt(spaceUsed(event))} of ${fmt(event.limit)}`, p: spaceUsed(event) / event.limit },
  { label: "Searches", value: `${fmt(event.searches)} of ${fmt(event.searchLimit)}`, p: event.searches / event.searchLimit },
  { label: event.plan === "trial" ? "Trial ends" : "Online until", value: event.until },
];
const planName = (event) => (event.plan === "trial" ? "Free trial" : "Paid");

const UPLOAD_STATE = {
  ready: (u) => `<span class="pill">Ready</span><span class="upload-note">${fmt(u.photos)} photos</span>`,
  busy: (u) => `<span class="pill busy">Finding faces</span><span class="upload-note">${fmt(u.done)} of ${fmt(u.photos)} photos</span><div class="meter"><i style="--p:${(u.done / u.photos) * 100}%"></i></div>`,
  bad: (u) => `<span class="pill bad">Not uploaded</span><span class="upload-note">${u.error}</span><button class="btn btn-sm btn-line" type="button">${icon("retry")}Upload again</button>`,
};
const uploadList = (event) => event.uploads.length
  ? `<ul class="uploads">${event.uploads.map((u) => `<li class="${u.state}"><p><b>${u.file}</b><span>${u.size}</span></p><div>${UPLOAD_STATE[u.state](u)}</div></li>`).join("")}</ul>`
  : "";
const dropZone = `<button class="drop" type="button">${icon("upload")}<b>Add photos</b><small>Drop ZIP files here or choose them. JPEG or PNG photos, up to 2 GB per ZIP.</small></button>`;

// The new-event and delete dialogs, the copy-link buttons, and anything with data-open="<dialog id>"
function mountDashboard() {
  document.body.insertAdjacentHTML("beforeend", `
<dialog id="new-event" aria-labelledby="new-event-title"><form method="dialog">
  <h2 id="new-event-title">New event</h2>
  <p class="muted">You can change these later.</p>
  <div class="field" style="margin-top:24px"><label for="ne-name">Event name</label><input class="input" id="ne-name" required placeholder="Harbor Summit Lisbon" autocomplete="off"></div>
  <div class="field"><label for="ne-addr">Page address</label><div class="addr"><input class="input" id="ne-addr" required pattern="[a-z0-9-]+" placeholder="harborsummit" autocomplete="off"><span>.findphotosofme.com</span></div><p class="hint">People open this link to find their photos.</p></div>
  <div class="actions"><button class="btn btn-line" value="cancel" formnovalidate>Cancel</button><button class="btn" value="create">Create event</button></div>
</form></dialog>
<dialog id="delete-event" aria-labelledby="delete-title"><form method="dialog">
  <h2 id="delete-title">Delete this event?</h2>
  <p class="muted">Its page stops working and all of its photos are deleted. You can’t undo this.</p>
  <div class="actions"><button class="btn btn-line" value="cancel">Cancel</button><button class="btn btn-danger" value="delete">Delete event</button></div>
</form></dialog>`);
  const name = document.getElementById("ne-name");
  const addr = document.getElementById("ne-addr");
  name.addEventListener("input", () => { if (!addr.dataset.edited) addr.value = slug(name.value); });
  addr.addEventListener("input", () => { addr.dataset.edited = "1"; });
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) document.getElementById(opener.dataset.open).showModal();
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      navigator.clipboard?.writeText(`https://${copy.dataset.copy}`);
      const label = copy.lastChild;
      label.textContent = "Copied";
      setTimeout(() => (label.textContent = "Copy link"), 1500);
    }
  });
}
