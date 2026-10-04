// Shared by the homepage and the audience pages. Each part sets up only the components present on the page.

// Pricing buttons open a note that this is a preview.
const previewDialog = document.getElementById("preview");
document.querySelectorAll("[data-preview]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("preview-title").textContent = link.dataset.preview;
  previewDialog.showModal();
}));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Counts a number up in an element's text, e.g. "2,140 of 5,214 checked".
function countUp(element, to, format, ms = 2400) {
  cancelAnimationFrame(element.countFrame);
  const start = performance.now();
  const tick = (now) => {
    const progress = reducedMotion ? 1 : Math.min((now - start) / ms, 1);
    element.textContent = format(Math.round(to * progress).toLocaleString("en-US"));
    if (progress < 1) element.countFrame = requestAnimationFrame(tick);
  };
  tick(start);
}

// Hero: one person's search through a pile of photos, on a loop.
const MATCHES = ["ev-01", "ev-02", "ev-03", "ev-04", "ev-05", "ev-06", "ev-07", "ev-08"];
const OTHERS = ["nx-01", "nx-02", "nx-03", "nx-04", "nx-05", "nx-06", "nx-07", "nx-08", "t01", "u03", "t04", "t05", "u04", "t06", "t07", "u05", "t08", "t10", "u06", "t12", "t13", "u08", "t14", "t15", "u13", "t17", "t18", "u14", "t19", "t21", "u29", "t22", "t24", "u31", "t25", "t27", "u32", "t28", "t29", "u33", "t31", "t34"];
// Match positions are spread across the grid; on narrow screens the grid is smaller, so they get their own slots.
const LAYOUTS = {
  wide: { cols: 10, rows: 5, slots: [3, 8, 14, 21, 26, 32, 37, 45], resultCols: 4 },
  narrow: { cols: 4, rows: 6, slots: [1, 6, 8, 11, 14, 17, 19, 22], resultCols: 2 },
};
const SEARCH_STEPS = [
  { state: "idle", ms: 1400 },
  { state: "selfie", ms: 1200 },
  { state: "scan", ms: 3700 },
  { state: "found", ms: 4600 },
];

const narrowScreen = matchMedia("(max-width: 700px)");

// The wording follows the page: data-pile names the photos, data-add-face and data-face label the face slot,
// data-looking is shown while searching, and data-found ends the result ("8 photos of you").
function setUpSearch(search) {
  const searchGrid = search.querySelector(".search-grid");
  const searchLabel = search.querySelector(".search-label");
  const searchCount = search.querySelector(".search-count");
  const searchFaceLabel = search.querySelector(".search-face-label");
  const { pile = "Event photos", addFace = "Add your photo", face = "Your photo", looking = "Looking for your photos", found = "photos of you" } = search.dataset;

  const makeTile = (src, isMatch) => {
    const tile = document.createElement("div");
    tile.className = isMatch ? "search-tile match" : "search-tile";
    tile.innerHTML = `<img src="assets/${src}.jpg" alt="">`;
    searchGrid.append(tile);
    return tile;
  };
  const matchTiles = MATCHES.map((src) => makeTile(src, true));
  const otherTiles = OTHERS.map((src) => makeTile(src, false));

  function layOutSearch() {
    const { cols, rows, slots, resultCols } = narrowScreen.matches ? LAYOUTS.narrow : LAYOUTS.wide;
    const resultRows = MATCHES.length / resultCols;
    searchGrid.style.aspectRatio = `${cols * 4} / ${rows * 3}`;
    const others = otherTiles.values();
    for (let slot = 0; slot < cols * rows; slot++) {
      const k = slots.indexOf(slot);
      const tile = k < 0 ? others.next().value : matchTiles[k];
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      tile.hidden = false;
      tile.style.cssText = `--x:${(col * 100) / cols}%;--y:${(row * 100) / rows}%;--w:${100 / cols}%;--h:${100 / rows}%;--sx:${col / (cols - 1)}`
        + (k < 0 ? "" : `;--k:${k};--rx:${((k % resultCols) * 100) / resultCols}%;--ry:${(Math.floor(k / resultCols) * 100) / resultRows}%;--rw:${100 / resultCols}%;--rh:${100 / resultRows}%`);
    }
    for (const tile of others) tile.hidden = true;
  }

  function showSearchState(state) {
    search.dataset.state = state;
    searchFaceLabel.textContent = state === "idle" ? addFace : face;
    cancelAnimationFrame(searchCount.countFrame);
    if (state === "scan") {
      searchLabel.textContent = looking;
      countUp(searchCount, 5214, (n) => `${n} of 5,214 photos checked`, 3100);
    } else if (state === "found") {
      searchLabel.textContent = `${MATCHES.length} ${found}`;
      searchCount.textContent = "out of 5,214";
    } else {
      searchLabel.textContent = pile;
      searchCount.textContent = "5,214 photos";
    }
  }

  let searchStep = -1;
  let searchTimer = 0;
  let searchVisible = false;
  function advanceSearch() {
    searchStep = (searchStep + 1) % SEARCH_STEPS.length;
    showSearchState(SEARCH_STEPS[searchStep].state);
    searchTimer = setTimeout(advanceSearch, SEARCH_STEPS[searchStep].ms);
  }
  function syncSearchPlayback() {
    clearTimeout(searchTimer);
    if (searchVisible) searchTimer = setTimeout(advanceSearch, 500);
  }

  layOutSearch();
  narrowScreen.addEventListener("change", layOutSearch);
  if (reducedMotion) {
    showSearchState("found");
  } else {
    new IntersectionObserver(([entry]) => {
      searchVisible = entry.isIntersecting;
      syncSearchPlayback();
    }, { threshold: 0.3 }).observe(search);
  }
}
document.querySelectorAll(".search").forEach(setUpSearch);

// Every phone shows the same chat, so pages with a phone include one template and mark where it goes with data-phone.
const phoneTemplate = document.getElementById("tg-phone");
document.querySelectorAll("[data-phone]").forEach((slot) => slot.replaceWith(phoneTemplate.content.firstElementChild.cloneNode(true)));

// Design options (prototype only): a pill switches which section of each .variants wrapper is shown, and the choice is kept across reloads.
document.querySelectorAll(".variants").forEach((wrapper) => {
  const options = [...wrapper.children];
  const key = `landing-v2:${location.pathname}:${wrapper.id}`;
  const switcher = document.createElement("div");
  switcher.className = "vs";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", `Design options for ${wrapper.dataset.title}`);
  const buttons = options.map((option, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.dataset.variant;
    button.addEventListener("click", () => show(i));
    return button;
  });
  const show = (index) => {
    options.forEach((option, i) => {
      option.hidden = i !== index;
      buttons[i].setAttribute("aria-pressed", i === index);
    });
    localStorage.setItem(key, index);
  };
  switcher.append(...buttons);
  wrapper.prepend(switcher);
  show(Math.min(Number(localStorage.getItem(key)) || 0, options.length - 1));
});

// Each demo plays through its phases once, every time it scrolls into view.
function playOnView(mock, phases, onPhase = () => {}) {
  const show = (phase) => {
    mock.dataset.phase = phase;
    onPhase(phase);
  };
  if (reducedMotion) return show(phases.at(-1)[0]);
  show(phases[0][0]);
  let timers = [];
  new IntersectionObserver(([entry]) => {
    timers.forEach(clearTimeout);
    if (!entry.isIntersecting) return;
    let at = 0;
    timers = phases.map(([phase, ms]) => {
      const timer = setTimeout(() => show(phase), at);
      at += ms;
      return timer;
    });
  }, { threshold: 0.35 }).observe(mock);
}

// How it works, step 1 photos with their faces, detected by Apple Vision: [photo, ...faces as [center x %, center y %, width %]]
const UPLOADED = [
  ["ev-01", [85, 32, 9], [67, 38, 9], [43, 42, 11], [97, 34, 7], [12, 51, 16], [29, 27, 7], [15, 33, 8], [2, 25, 6], [53, 27, 6]],
  ["nx-05", [20, 36, 10], [78, 41, 10], [37, 28, 11], [58, 27, 11]],
  ["ev-03", [11, 35, 11], [84, 37, 10], [22, 29, 9], [51, 29, 11]],
  ["nx-06", [22, 31, 7], [43, 29, 9], [13, 22, 8], [91, 31, 5], [61, 24, 10], [29, 25, 4]],
  ["ev-04", [9, 57, 5], [77, 58, 5], [23, 55, 5], [26, 16, 4], [66, 57, 5], [32, 31, 4], [51, 56, 6], [64, 19, 4], [13, 32, 5], [16, 16, 5], [81, 34, 4], [90, 32, 5], [90, 58, 5], [83, 15, 4], [71, 32, 5], [46, 15, 4], [22, 33, 4], [55, 18, 4], [61, 34, 4], [51, 32, 5], [74, 18, 4]],
  ["nx-02", [36, 29, 11], [70, 21, 10], [5, 32, 4]],
  ["ev-02", [50, 30, 14], [22, 33, 11], [86, 27, 11]],
  ["nx-08", [63, 40, 7], [39, 28, 7], [55, 33, 4], [74, 27, 8], [8, 30, 4], [13, 28, 3], [29, 40, 7]],
  ["ev-08", [49, 32, 10], [7, 76, 18], [79, 28, 8], [95, 33, 5], [27, 31, 7], [59, 17, 5]],
  ["nx-03", [50, 24, 7], [16, 22, 8], [84, 24, 6]],
  ["ev-05", [43, 24, 14], [93, 59, 11], [74, 62, 12], [69, 45, 8], [4, 50, 8], [22, 48, 9], [86, 45, 6], [64, 44, 6]],
  ["ev-07", [46, 23, 12], [23, 13, 7], [30, 26, 9], [8, 15, 5]],
];
const UPLOAD_LABELS = { idle: "Waiting for photos", drag: "Waiting for photos", upload: "Uploading photos", faces: "Finding faces", ready: "✓ Ready to search" };
const uploadTiles = UPLOADED.map(([photo, ...faces], i) =>
  `<i style="--i:${i}"><img src="assets/${photo}.jpg" alt="">${faces.map(([x, y, w]) => `<b style="left:${x}%;top:${y}%;width:${w}%"></b>`).join("")}</i>`).join("");

document.querySelectorAll(".upload").forEach((upload) => {
  const uploadCount = upload.querySelector(".upload-count");
  const uploadLabel = upload.querySelector(".upload-label");
  const uploadDetail = upload.querySelector(".upload-detail");
  upload.querySelector(".upload-tiles").innerHTML = uploadTiles;
  playOnView(upload, [["idle", 500], ["drag", 1300], ["upload", 2700], ["faces", 2500], ["ready", 0]], (phase) => {
    cancelAnimationFrame(uploadCount.countFrame);
    cancelAnimationFrame(uploadDetail.countFrame);
    uploadLabel.textContent = UPLOAD_LABELS[phase];
    uploadCount.textContent = phase === "faces" || phase === "ready" ? "5,214 photos" : "0 photos";
    uploadDetail.textContent = phase === "ready" ? "11,872 faces" : "";
    if (phase === "upload") countUp(uploadCount, 5214, (n) => `${n} photos`, 2400);
    if (phase === "faces") countUp(uploadDetail, 11872, (n) => `${n} faces`, 2200);
  });
});

// How it works, step 2: a reference face, then its matches.
document.querySelectorAll(".lookup").forEach((lookup) => {
  const lookupTitle = lookup.querySelector(".lookup-title");
  const lookupFile = lookup.querySelector(".lookup-file");
  const lookupCount = lookup.querySelector(".lookup-count");
  playOnView(lookup, [["idle", 800], ["face", 1100], ["search", 3300], ["done", 0]], (phase) => {
    cancelAnimationFrame(lookupCount.countFrame);
    lookupTitle.textContent = phase === "idle" ? "Add your selfie" : "Your selfie";
    lookupFile.textContent = phase === "idle" ? "JPEG, PNG, or WebP" : "my-photo.jpg";
    if (phase === "idle") lookupCount.textContent = "Waiting for your selfie";
    if (phase === "face") lookupCount.textContent = "Ready to search 5,214 photos";
    if (phase === "search") countUp(lookupCount, 8, (n) => `Searching 5,214 photos: ${n} found`, 8 * 320 + 300);
    if (phase === "done") lookupCount.innerHTML = "<b>8 matches</b> in 5,214 photos";
  });
});

// Photo bot: the chat plays out message by message.
document.querySelectorAll(".iphone.tg").forEach((chat) => playOnView(chat, [["idle", 300], ["play", 0]]));

// Calls tick every few seconds while the element is on screen.
function loopOnView(element, ms, tick) {
  if (reducedMotion) return;
  let timer = 0;
  new IntersectionObserver(([entry]) => {
    clearInterval(timer);
    if (entry.isIntersecting) timer = setInterval(tick, ms);
  }, { threshold: 0.3 }).observe(element);
}

const FOLDER_START = 247;
const FOLDER_SIZE = 5214;
const folderCount = (n) => `Photo ${n.toLocaleString("en-US")} of ${FOLDER_SIZE.toLocaleString("en-US")}`;

// Problem, Viewer: steps through the folder on its own; the strip keeps the current photo under the yellow frame.
const VIEWER_PHOTOS = ["p03", "nx-01", "p09", "nx-03", "p11", "nx-08", "p16", "nx-02", "p20", "nx-05", "p26", "nx-07", "p30", "nx-04", "p02", "nx-06"];
document.querySelectorAll(".viewer").forEach((viewer) => {
  const photo = viewer.querySelector(".viewer-photo");
  const count = viewer.querySelector(".viewer-count");
  const track = viewer.querySelector(".viewer-track");
  // Three copies of the photos, starting in the middle one, so the strip is full on both sides.
  const set = VIEWER_PHOTOS.length;
  const thumbs = [...VIEWER_PHOTOS, ...VIEWER_PHOTOS, ...VIEWER_PHOTOS];
  track.innerHTML = thumbs.map((src) => `<img src="assets/${src}.jpg" alt="">`).join("");
  let at = set;
  let viewerSteps = 0;
  const show = (animate) => {
    const thumb = track.children[at];
    track.style.transition = animate ? "" : "none";
    track.style.translate = `calc(${track.parentElement.clientWidth / 2}px - ${thumb.offsetLeft + thumb.offsetWidth / 2}px) 0`;
    photo.src = thumb.src;
    count.textContent = folderCount(FOLDER_START + viewerSteps);
  };
  // When the strip reaches the last copy, it jumps back to the same photo in the middle copy.
  const advance = () => {
    viewerSteps++;
    at++;
    show(true);
    if (at === set * 2) setTimeout(() => { at = set; show(false); }, 600);
  };
  new ResizeObserver(() => show(false)).observe(viewer);
  loopOnView(viewer, 1300, advance);
});

// QR code cards: a decorative code with the three corner markers and a fixed pattern.
function drawQr(svg) {
  const size = 25;
  let seed = 11;
  const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const corners = [[0, 0], [size - 7, 0], [0, size - 7]];
  const nearCorner = (x, y) => corners.some(([cx, cy]) => x >= cx - 1 && x <= cx + 7 && y >= cy - 1 && y <= cy + 7);
  let modules = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!nearCorner(x, y) && random() < 0.5) modules += `M${x} ${y}h1v1h-1z`;
  const markers = corners.map(([x, y]) => `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5zM${x + 2} ${y + 2}h3v3h-3z`).join("");
  svg.innerHTML = `<path d="${modules}${markers}" fill="#151515" fill-rule="evenodd"/>`;
}
document.querySelectorAll(".qr").forEach(drawQr);


// Photographers, branding: the color swatches recolor the gallery preview.
document.querySelectorAll(".brand-demo").forEach((demo) => {
  const swatches = [...demo.querySelectorAll(".swatches button")];
  swatches.forEach((swatch) => swatch.addEventListener("click", () => {
    demo.style.setProperty("--accent", swatch.style.getPropertyValue("--c"));
    swatches.forEach((other) => other.setAttribute("aria-pressed", other === swatch));
  }));
});
