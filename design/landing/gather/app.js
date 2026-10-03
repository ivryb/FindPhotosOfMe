(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- Illustrated people ---------- */

  const INK = '#172C30', SPRUCE = '#196657', MIST = '#EAF3F0', LEMON = '#F4DC79';

  // Mira is the one consistent sample attendee: bun, round glasses, blue top,
  // lemon earrings. No generated guest shares her bun or her blue.
  const MIRA = { skin: '#A0673F', hair: '#2A1A12', style: 'bun', top: '#3D62B3', glasses: true, badge: true, earring: true };

  const SKINS = ['#F1C7A5', '#D9A47E', '#7E4E31', '#5A3824', '#E7B38E', '#C38659'];
  const HAIRS = ['#3B2A20', '#8A5A33', '#1F1B19', '#C9A46E', '#9A9A96', '#5A3825'];
  const STYLES = ['short', 'long', 'curly', 'bald', 'short', 'long', 'curly'];
  const TOPS = ['#526366', '#196657', '#D3DDD9', '#8FA7A0', '#2F4A50', '#B48A6A', '#E9E4D8', '#7C6A8E'];

  const guest = n => ({
    skin: SKINS[n % 6],
    hair: HAIRS[(n * 5 + 2) % 6],
    style: STYLES[(n * 3 + 1) % 7],
    top: TOPS[(n * 5 + 3) % 8],
    glasses: n % 5 === 2,
    badge: n % 3 !== 1
  });

  const HAIR_FRONT = {
    short: h => `<path d="M-9-1C-10-13 10-13 9-1C7-6 1-8-6-6C-8-5-9-3-9-1Z" fill="${h}"/>`,
    long: h => `<path d="M-9 1C-10-13 10-13 9 1C6-6-6-6-9 1Z" fill="${h}"/>`,
    bun: h => `<path d="M-9 0C-10-12.5 10-12.5 9 0C7-6-7-6-9 0Z" fill="${h}"/>`,
    curly: h => `<g fill="${h}"><circle cx="-6" cy="-6" r="4.6"/><circle cy="-9" r="5"/><circle cx="6" cy="-6" r="4.6"/><circle cx="-8.5" cy="-1" r="3"/><circle cx="8.5" cy="-1" r="3"/></g>`,
    bald: () => ''
  };

  // Head centre sits at (x, y); s scales the figure. Bodies run off the frame.
  function person(p, x, y, s = 1, back = false) {
    const h = p.hair, k = p.skin;
    let out = '';
    if (p.style === 'long') out += `<path d="M-10 0C-11-15 11-15 10 0L11 16H-11Z" fill="${h}"/>`;
    if (p.style === 'bun') out += `<circle cy="-12.5" r="4.8" fill="${h}"/>`;
    out += `<path d="M-17 44C-17 21-11 14 0 14S17 21 17 44Z" fill="${p.top}"/><rect x="-3" y="6" width="6" height="9" fill="${k}"/>`;
    if (back) {
      out += `<ellipse rx="8.5" ry="9.5" fill="${p.style === 'bald' ? k : h}"/>`;
    } else {
      out += `<ellipse rx="8.5" ry="9.5" fill="${k}"/>${HAIR_FRONT[p.style](h)}`;
      out += `<circle cx="-3.3" cy=".6" r=".95" fill="${INK}"/><circle cx="3.3" cy=".6" r=".95" fill="${INK}"/>`;
      out += `<path d="M-2.6 4.6Q0 6.4 2.6 4.6" stroke="${INK}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
      if (p.glasses) out += `<g fill="none" stroke="${INK}" stroke-width="1.1"><circle cx="-3.4" cy=".5" r="2.7"/><circle cx="3.4" cy=".5" r="2.7"/><path d="M-.7.3h1.4"/></g>`;
      if (p.earring) out += `<circle cx="-8.6" cy="3.6" r="1.4" fill="${LEMON}"/><circle cx="8.6" cy="3.6" r="1.4" fill="${LEMON}"/>`;
      if (p.badge) out += `<path d="M-6 15L0 27L6 15" fill="none" stroke="${SPRUCE}" stroke-width="1.2"/><rect x="-4.5" y="26" width="9" height="11" rx="1.2" fill="#fff"/><rect x="-4.5" y="26" width="9" height="3" rx="1" fill="${SPRUCE}"/>`;
      if (p.mic) out += `<circle cx="10.5" cy="15" r="3" fill="${k}"/><rect x="9" y="3" width="2.6" height="12" rx="1.3" fill="${INK}" transform="rotate(18 10 9)"/><circle cx="8.6" cy="3" r="2.4" fill="#3A4B4E"/>`;
    }
    return `<g transform="translate(${x} ${y}) scale(${s})">${out}</g>`;
  }

  const row = (cast, from, xs, y, s, back) => xs.map((x, i) => person(cast[from + i], x, y, s, back)).join('');

  /* ---------- Event scenes (160 × 120) ---------- */

  const SCENES = {
    stage: {
      size: 7, slot: 0, label: 'a speaker on stage',
      draw: c => `<rect width="160" height="120" fill="#21434A"/><rect x="30" y="10" width="100" height="52" rx="2" fill="${MIST}"/><rect x="40" y="21" width="44" height="6" rx="3" fill="${SPRUCE}"/><rect x="40" y="33" width="64" height="3" rx="1.5" fill="#A9C2BB"/><rect x="40" y="40" width="54" height="3" rx="1.5" fill="#A9C2BB"/><rect y="80" width="160" height="40" fill="#2E555B"/>${person(c[0], 112, 58)}<path d="M98 82h28l-3 30h-22z" fill="${INK}"/>${row(c, 1, [12, 38, 64, 90, 116, 142], 108, 1.15, true)}`
    },
    talk: {
      size: 3, slot: 1, label: 'a conversation between sessions',
      draw: c => `<rect width="160" height="120" fill="#D5E3DE"/><rect width="160" height="66" fill="${MIST}"/><path d="M40 0v66M80 0v66M120 0v66" stroke="#C3D5CF" stroke-width="2"/><rect y="88" width="160" height="32" fill="#BFD1CB"/>${person(c[0], 42, 50, 1.4)}${person(c[1], 84, 56, 1.3)}${person(c[2], 124, 48, 1.45)}`
    },
    group: {
      size: 9, slot: 6, label: 'a group photo',
      draw: c => `<rect width="160" height="120" fill="${SPRUCE}"/><rect x="18" y="8" width="124" height="22" rx="3" fill="#227A69"/><rect x="30" y="15" width="60" height="8" rx="4" fill="${MIST}"/><rect x="96" y="16" width="34" height="6" rx="3" fill="#7FB3A6"/><rect y="98" width="160" height="22" fill="#14524A"/>${row(c, 0, [22, 51, 80, 109, 138], 48, .95)}${row(c, 5, [36, 65, 94, 123], 74, 1.1)}`
    },
    desk: {
      size: 2, slot: 1, label: 'the registration desk',
      draw: c => `<rect width="160" height="120" fill="${MIST}"/><rect x="20" y="12" width="70" height="16" rx="3" fill="${SPRUCE}"/><rect x="28" y="18" width="40" height="4" rx="2" fill="${MIST}"/>${person(c[0], 46, 58, 1.25)}<rect y="82" width="160" height="38" fill="#fff"/><rect y="82" width="160" height="3" fill="#B9CBC6"/>${[12, 28, 60, 76].map(x => `<rect x="${x}" y="92" width="11" height="14" rx="1.5" fill="${MIST}" stroke="#9DB5AE"/>`).join('')}${person(c[1], 116, 54, 1.45)}`
    },
    panel: {
      size: 3, slot: 1, label: 'a panel discussion',
      draw: c => `<rect width="160" height="120" fill="#21434A"/><rect width="160" height="38" fill="#1B3A40"/><rect x="50" y="12" width="60" height="5" rx="2.5" fill="#5F8F86"/>${row(c, 0, [38, 80, 122], 58, 1.05)}<rect x="52" y="77" width="5" height="9" rx="1" fill="#CFE3DD"/><rect x="94" y="77" width="5" height="9" rx="1" fill="#CFE3DD"/><rect x="18" y="86" width="124" height="34" fill="${INK}"/><rect x="18" y="86" width="124" height="3" fill="#5F8F86"/>`
    },
    audience: {
      size: 16, slot: 8, label: 'the audience during a talk',
      draw: c => `<rect width="160" height="120" fill="#CBDAD5"/>${row(c, 0, [14, 40, 66, 92, 118, 144], 28, .72)}<rect y="48" width="160" height="9" fill="#8FA9A2"/>${row(c, 6, [24, 56, 88, 120, 152], 60, .9)}<rect y="84" width="160" height="10" fill="#7F9B94"/>${row(c, 11, [10, 44, 78, 112, 146], 96, 1.1)}`
    },
    coffee: {
      size: 2, slot: 0, label: 'a coffee break',
      draw: c => `<rect width="160" height="120" fill="#F2F6F4"/><rect x="120" y="18" width="30" height="46" rx="2" fill="${MIST}" stroke="#C3D5CF"/><circle cx="20" cy="66" r="15" fill="#7FB3A6"/><rect x="17" y="78" width="6" height="42" fill="#5F8F86"/>${person(c[0], 58, 48, 1.45)}${person(c[1], 104, 52, 1.4)}<rect x="78" y="94" width="4" height="26" fill="#9DB5AE"/><ellipse cx="80" cy="92" rx="22" ry="5" fill="#fff" stroke="#B9CBC6"/><rect x="72" y="83" width="6" height="8" rx="1" fill="${SPRUCE}"/>`
    },
    workshop: {
      size: 3, slot: 1, label: 'a workshop table',
      draw: c => `<rect width="160" height="120" fill="${MIST}"/><rect x="10" y="10" width="56" height="34" rx="2" fill="#fff" stroke="#C3D5CF"/><rect x="18" y="18" width="30" height="4" rx="2" fill="#9DB5AE"/>${person(c[0], 38, 58, 1.15)}${person(c[1], 82, 54, 1.2)}${person(c[2], 126, 58, 1.15)}<rect y="84" width="160" height="36" fill="#D9C7A8"/><rect x="28" y="70" width="30" height="16" rx="2" fill="#3A4B4E"/><rect x="98" y="70" width="30" height="16" rx="2" fill="#3A4B4E"/>`
    },
    race: {
      size: 2, slot: 0, label: 'runners at a finish line',
      draw: c => `<rect width="160" height="120" fill="#DCEBE6"/><rect y="80" width="160" height="40" fill="#9DB0AC"/><path d="M16 80V18h128v62" fill="none" stroke="${SPRUCE}" stroke-width="7"/><rect x="12" y="10" width="136" height="16" fill="${SPRUCE}"/><rect x="50" y="15" width="60" height="6" rx="3" fill="${MIST}"/>${person(c[0], 62, 58, 1.3)}${person(c[1], 104, 64, 1.2)}`
    }
  };

  function castFor(scene, seed, withMira) {
    const def = SCENES[scene];
    const cast = Array.from({ length: def.size }, (_, j) => guest(seed * 7 + j * 5 + 1));
    if (withMira) cast[def.slot] = scene === 'audience' ? { ...MIRA, mic: true } : MIRA;
    return cast;
  }

  function sceneSVG(scene, seed, withMira, label) {
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" focusable="false" ${a11y}>${SCENES[scene].draw(castFor(scene, seed, withMira))}</svg>`;
  }

  const selfieSVG = `<svg viewBox="0 0 60 60" focusable="false" role="img" aria-label="Illustrated selfie of Mira: dark hair in a bun, round glasses, lemon earrings"><rect width="60" height="60" fill="${MIST}"/>${person(MIRA, 30, 28, 1.9)}</svg>`;

  /* ---------- Sample collection ---------- */

  const ORDER = ['group', 'coffee', 'talk', 'stage', 'workshop', 'audience', 'panel', 'stage', 'talk', 'coffee', 'workshop', 'desk',
    'group', 'panel', 'stage', 'talk', 'audience', 'coffee', 'desk', 'workshop', 'talk', 'group', 'panel', 'audience'];
  const MATCHES = { 2: 'Between sessions', 7: 'On stage', 11: 'At registration', 16: 'Asking a question', 21: 'Group photo' };

  $$('[data-selfie]').forEach(el => { el.innerHTML = selfieSVG; });

  $$('[data-scene]').forEach(el => {
    el.innerHTML = sceneSVG(el.dataset.scene, Number(el.dataset.seed) || 0, 'mira' in el.dataset, el.dataset.label || '');
  });

  const sheet = $('[data-sheet]');
  let matchIndex = 0;
  sheet.innerHTML = ORDER.map((scene, i) => {
    const cap = MATCHES[i];
    if (!cap) return `<div class="tile" role="listitem">${sceneSVG(scene, i, false, `Sample photo ${i + 1}: ${SCENES[scene].label}`)}</div>`;
    const cls = matchIndex === 0 ? ' tile--lead' : matchIndex >= 3 ? ' tile--wide' : '';
    matchIndex++;
    return `<div class="tile${cls}" role="listitem" data-match>${sceneSVG(scene, i, true, `Sample photo ${i + 1}: ${SCENES[scene].label}, with Mira`)}<span class="tile__cap">${cap}</span></div>`;
  }).join('');

  $('[data-results]').innerHTML = Object.entries(MATCHES).map(([i, cap]) =>
    `<figure class="result">${sceneSVG(ORDER[i], Number(i), true, `Sample match: Mira, ${SCENES[ORDER[i]].label}`)}<figcaption>${cap}</figcaption><button class="result__dl" type="button" data-preview="download" aria-label="Download sample photo: ${cap}">Download</button></figure>`
  ).join('');

  const ALBUM_KEYS = Object.keys(SCENES).filter(k => k !== 'race');
  $('[data-album]').innerHTML = Array.from({ length: 40 }, (_, i) => {
    const scene = ALBUM_KEYS[(i * 5 + 2) % ALBUM_KEYS.length];
    return `<div class="album__tile">${sceneSVG(scene, i + 100, i === 13 || i === 30, '')}</div>`;
  }).join('');

  /* ---------- Narrowing demo ---------- */

  const searchBtn = $('[data-search]');
  const status = $('[data-status]');
  const tiles = $$('.tile', sheet);
  let narrowed = false;
  let busy = false;

  // FLIP: measure, change layout, then animate each tile from its old box.
  function flip(mutate) {
    const first = new Map(tiles.map(t => [t, t.getBoundingClientRect()]));
    mutate();
    if (reduceMotion.matches) return;
    tiles.forEach(t => {
      if (t.hidden) return;
      const a = first.get(t), b = t.getBoundingClientRect();
      if (!b.width) return;
      if (!a.width) {
        t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
        return;
      }
      t.animate([
        { transformOrigin: '0 0', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
        { transformOrigin: '0 0', transform: 'none' }
      ], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
  }

  function search() {
    if (busy || narrowed) return;
    busy = true;
    searchBtn.setAttribute('aria-disabled', 'true');
    sheet.classList.add('is-searching');
    status.textContent = 'Searching this event’s photos.';
    setTimeout(() => {
      flip(() => {
        tiles.forEach(t => { if (!('match' in t.dataset)) t.hidden = true; });
        sheet.classList.remove('is-searching');
        sheet.classList.add('is-narrowed');
      });
      narrowed = true;
      busy = false;
      searchBtn.removeAttribute('aria-disabled');
      searchBtn.setAttribute('aria-pressed', 'true');
      searchBtn.textContent = 'Show all 24 photos';
      status.textContent = '5 likely matches for Mira in this sample. Matches can be imperfect; review them before downloading.';
    }, reduceMotion.matches ? 0 : 900);
  }

  function reset() {
    if (busy) return;
    flip(() => {
      tiles.forEach(t => { t.hidden = false; });
      sheet.classList.remove('is-narrowed');
    });
    narrowed = false;
    searchBtn.setAttribute('aria-pressed', 'false');
    searchBtn.textContent = 'Search with this selfie';
    status.textContent = '24 illustrated sample photos. Choose “Search with this selfie” to narrow them.';
  }

  searchBtn.addEventListener('click', () => (narrowed ? reset() : search()));

  // "Explore the demo": bring the demo into view, then run the search once.
  $$('[data-explore]').forEach(btn => btn.addEventListener('click', () => {
    closeNav();
    const demo = $('#demo');
    const rect = demo.getBoundingClientRect();
    const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
    demo.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    searchBtn.focus({ preventScroll: true });
    setTimeout(search, inView || reduceMotion.matches ? 0 : 600);
  }));

  /* ---------- Attendee phone preview ---------- */

  $$('input[name="phone-state"]').forEach(r => r.addEventListener('change', () => {
    $$('[data-phone]').forEach(p => { p.hidden = p.dataset.phone !== r.value; });
  }));

  /* ---------- Organizer dashboard preview ---------- */

  const dashStatus = $('[data-dash-status]');
  const copyStatus = $('[data-copy-status]');
  $$('input[name="dash-state"]').forEach(r => r.addEventListener('change', () => {
    $$('[data-dash]').forEach(p => { p.hidden = p.dataset.dash !== r.value; });
    const ready = r.value === 'ready';
    dashStatus.textContent = ready ? 'Ready to share' : 'Preparing photos';
    dashStatus.classList.toggle('pill--ready', ready);
    copyStatus.textContent = '';
  }));

  $('[data-copy]').addEventListener('click', () => {
    const input = $('#share-link');
    const fail = () => {
      input.select();
      copyStatus.textContent = 'Copying isn’t available here. The link text is selected so you can copy it yourself.';
    };
    if (!navigator.clipboard) return fail();
    navigator.clipboard.writeText(input.value)
      .then(() => { copyStatus.textContent = 'Sample link copied. It points to example.com, not a real event.'; })
      .catch(fail);
  });

  /* ---------- Preview dialog ---------- */

  const MESSAGES = {
    setup: 'Event setup isn’t connected in this design preview. No account, event, or payment is created. Launch pricing is being finalized.',
    download: 'Downloads are off in this design preview. In the live product, attendees download the photographs they choose.',
    retry: 'Uploads are off in this design preview. In the live product, you would choose a new, clear photo with one face.'
  };
  const dialog = $('#preview-dialog');
  const dialogMsg = $('[data-dialog-msg]', dialog);
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-preview]');
    if (!trigger) return;
    dialogMsg.textContent = MESSAGES[trigger.dataset.preview];
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.alert(dialogMsg.textContent);
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  /* ---------- Mobile navigation ---------- */

  const navToggle = $('[data-nav-toggle]');
  const nav = $('#site-nav');
  function closeNav() {
    navToggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  }
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  $$('a', nav).forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeNav(); navToggle.focus(); } });
})();
