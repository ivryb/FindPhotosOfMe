/* Illustrated sample scenes for the Spotlight concept.
   Every person is drawn, not photographed. Olena and Marko are fixed characters,
   so the demo can show the same person in a selfie and in their results.
   Everyone else is generated from a seed, and their colours never copy Olena's
   lemon top or Marko's green sweater. */
(function () {
  'use strict';

  const INK = '#152358';
  const CAST = {
    olena: { name: 'Olena', skin: '#F2C4A2', hair: '#A3442A', style: 'bun', top: '#FFE08B', glasses: true },
    marko: { name: 'Marko', skin: '#B57850', hair: '#2A1F1A', style: 'short', top: '#3E8E6A', beard: true }
  };
  const SKINS = ['#F6D2B5', '#E8B48F', '#C98B62', '#A06642', '#7B4A31', '#F0C9A8'];
  const HAIRS = ['#2A2320', '#4E3424', '#7A5A3C', '#C9A469', '#9A9A9A', '#3B2A22'];
  const TOPS = ['#485778', '#9FB3E8', '#FFFFFF', '#152358', '#C7D2F0', '#C9A27E', '#7C6FA8', '#E1867A', '#5B6B8C'];
  const STYLES = ['short', 'long', 'curly', 'bald', 'bob', 'short', 'long'];

  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  const extra = (r) => ({
    skin: pick(r, SKINS), hair: pick(r, HAIRS), style: pick(r, STYLES), top: pick(r, TOPS),
    glasses: r() < 0.18, beard: r() < 0.14
  });
  const resolve = (who, r) => (who && CAST[who]) || extra(r);

  function torso(top) {
    const edge = top === '#FFFFFF' ? ' stroke="#C7D2F0" stroke-width="1.5"' : '';
    return `<path d="M-28 100V20C-28 6 -20 1 -10 0H10C20 1 28 6 28 20V100Z" fill="${top}"${edge}/>`;
  }

  function hairBack(p) {
    if (p.style === 'long') return `<path d="M-17 -22C-18 -43 18 -43 17 -22L20 10H-20Z" fill="${p.hair}"/>`;
    if (p.style === 'bob') return `<path d="M-17 -22C-18 -43 18 -43 17 -22L18 -4H-18Z" fill="${p.hair}"/>`;
    return '';
  }

  function hairFront(p) {
    const f = `fill="${p.hair}"`;
    switch (p.style) {
      case 'short':
        return `<path d="M-14.5 -18C-16 -36 -6 -40 0 -39.5C8 -40 16 -35 14.5 -18C11 -28 4 -30 -3 -28C-8 -27 -12 -24 -14.5 -18Z" ${f}/>`;
      case 'bun':
        return `<circle cx="0" cy="-42" r="8.5" ${f}/><path d="M-14.5 -18C-16 -45 16 -45 14.5 -18C10 -30 -4 -32 -14.5 -18Z" ${f}/>`;
      case 'long':
      case 'bob':
        return `<path d="M-15 -17C-16 -45 16 -45 15 -17C9 -29 -5 -30 -15 -17Z" ${f}/>`;
      case 'curly':
        return [[-12, -28], [-5, -34], [3, -35], [10, -31], [14, -24], [-15, -21]]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" ${f}/>`).join('');
      default:
        return '';
    }
  }

  // Origin sits at the base of the neck; the torso runs off the bottom of most frames.
  function person(p, x, y, s, o = {}) {
    const parts = [];
    if (o.back) {
      parts.push(torso(p.top), `<ellipse cx="0" cy="-20" rx="15" ry="18" fill="${p.style === 'bald' ? p.skin : p.hair}"/>`);
      if (p.style === 'bun') parts.push(`<circle cx="0" cy="-40" r="8.5" fill="${p.hair}"/>`);
    } else {
      parts.push(
        hairBack(p),
        torso(p.top),
        `<path d="M-8 0L0 10L8 0Z" fill="${p.skin}"/><rect x="-5" y="-8" width="10" height="10" fill="${p.skin}"/>`,
        `<ellipse cx="-14" cy="-19" rx="3" ry="4.5" fill="${p.skin}"/><ellipse cx="14" cy="-19" rx="3" ry="4.5" fill="${p.skin}"/>`,
        `<ellipse cx="0" cy="-20" rx="14" ry="17" fill="${p.skin}"/>`,
        hairFront(p)
      );
      if (p.beard) parts.push(`<path d="M-14 -20C-14 -4 -6 1 0 1C6 1 14 -4 14 -20C11 -12 6 -9 0 -9C-6 -9 -11 -12 -14 -20Z" fill="${p.hair}"/>`);
      parts.push(
        `<circle cx="-5.5" cy="-21" r="1.5" fill="${INK}"/><circle cx="5.5" cy="-21" r="1.5" fill="${INK}"/>`,
        `<path d="M-4 -10Q0 -7 4 -10" stroke="${p.beard ? '#F0D2BE' : '#7A3B2E'}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
      );
      if (p.glasses) {
        parts.push(`<g stroke="${INK}" stroke-width="1.6" fill="none"><circle cx="-6" cy="-21" r="4.8"/><circle cx="6" cy="-21" r="4.8"/><path d="M-1.2 -21H1.2"/></g>`);
      }
      if (o.badge !== false) {
        parts.push(
          `<path d="M-8 1L-3 34M8 1L3 34" stroke="#2449D8" stroke-width="2.2" fill="none"/>`,
          `<rect x="-9" y="32" width="18" height="23" rx="2" fill="#fff" stroke="#C7D2F0"/><rect x="-9" y="32" width="18" height="7" rx="2" fill="#2449D8"/>`,
          `<rect x="-6" y="43" width="12" height="2" fill="#485778"/><rect x="-6" y="48" width="8" height="2" fill="#485778"/>`
        );
      }
      if (o.mic) {
        parts.push(
          `<path d="M23 18C33 6 24 -6 13 -9" stroke="${p.top}" stroke-width="9" fill="none" stroke-linecap="round"/>`,
          `<rect x="4" y="-17" width="5" height="12" rx="2.5" fill="${INK}" transform="rotate(35 6.5 -11)"/><circle cx="12" cy="-9" r="4" fill="${p.skin}"/>`
        );
      }
    }
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})">${parts.join('')}</g>`;
  }

  const spread = (n, two, three) => (n === 3 ? three : two);
  const jitter = (r, n) => r() * n * 2 - n;

  const SCENES = {
    stage(spec, r) {
      let s = '<rect width="320" height="200" fill="#152358"/>' +
        '<path d="M58 0H128L156 150H30Z" fill="#FFE08B" opacity=".16"/>' +
        '<rect x="160" y="22" width="140" height="84" rx="3" fill="#2449D8"/>' +
        '<rect x="174" y="38" width="64" height="9" fill="#fff"/>' +
        '<rect x="174" y="56" width="104" height="4" fill="#fff" opacity=".65"/>' +
        '<rect x="174" y="66" width="88" height="4" fill="#fff" opacity=".65"/>' +
        '<circle cx="276" cy="86" r="9" fill="#FFE08B"/>' +
        '<rect y="138" width="320" height="62" fill="#1E2F78"/><rect y="138" width="320" height="4" fill="#2449D8"/>';
      s += person(resolve(spec.speaker, r), 94, 84, 0.95, { mic: true });
      for (let i = 0; i < 6; i++) s += person(extra(r), 18 + i * 58 + jitter(r, 5), 188 + r() * 6, 1.05, { back: true });
      return s;
    },

    talk(spec, r) {
      const xs = spread(spec.cast.length, [112, 208], [72, 160, 248]);
      let s = '<rect width="320" height="200" fill="#E9EEFF"/>' +
        '<rect x="18" y="14" width="128" height="96" fill="#fff" opacity=".75"/><path d="M82 14V110M18 62H146" stroke="#C7D2F0" stroke-width="3"/>' +
        '<rect x="176" y="14" width="128" height="96" fill="#fff" opacity=".75"/><path d="M240 14V110M176 62H304" stroke="#C7D2F0" stroke-width="3"/>' +
        '<rect y="150" width="320" height="50" fill="#D6DEF7"/>';
      spec.cast.forEach((who, i) => { s += person(resolve(who, r), xs[i] + jitter(r, 4), 96 + r() * 6, 1.05); });
      return s + '<ellipse cx="160" cy="166" rx="40" ry="7" fill="#fff"/><rect x="157" y="166" width="6" height="40" fill="#485778"/>' +
        '<rect x="150" y="153" width="9" height="12" rx="2" fill="#2449D8"/>';
    },

    coffee(spec, r) {
      const xs = spread(spec.cast.length, [104, 214], [70, 160, 250]);
      let s = '<rect width="320" height="200" fill="#F4F6FD"/>' +
        '<path d="M60 0V30M160 0V30M260 0V30" stroke="#485778" stroke-width="2"/>' +
        '<path d="M44 42A16 12 0 0 1 76 42ZM144 42A16 12 0 0 1 176 42ZM244 42A16 12 0 0 1 276 42Z" fill="#FFE08B"/>' +
        '<rect y="96" width="320" height="26" fill="#C7D2F0"/>' +
        '<rect x="232" y="56" width="44" height="40" rx="3" fill="#152358"/><circle cx="254" cy="72" r="6" fill="#FFE08B"/>' +
        '<rect y="150" width="320" height="50" fill="#E1E7FA"/>';
      spec.cast.forEach((who, i) => { s += person(resolve(who, r), xs[i] + jitter(r, 4), 100 + r() * 5, 1.05); });
      return s;
    },

    workshop(spec, r) {
      const xs = spread(spec.cast.length, [104, 216], [70, 160, 250]);
      const notes = [[44, 24, '#FFE08B'], [74, 32, '#C7D2F0'], [104, 22, '#FFE08B'], [200, 26, '#C7D2F0'], [232, 34, '#FFE08B'], [262, 22, '#C7D2F0']];
      let s = '<rect width="320" height="200" fill="#E9EEFF"/><rect x="24" y="14" width="272" height="66" rx="3" fill="#fff"/>' +
        notes.map(([x, y, c]) => `<rect x="${x}" y="${y}" width="22" height="20" fill="${c}"/>`).join('');
      spec.cast.forEach((who, i) => { s += person(resolve(who, r), xs[i] + jitter(r, 4), 106 + r() * 4, 0.95); });
      s += '<rect y="150" width="320" height="50" fill="#C9D3F2"/><rect y="150" width="320" height="5" fill="#9FB3E8"/>';
      xs.forEach((x) => { s += `<rect x="${x - 24}" y="126" width="48" height="26" rx="3" fill="#485778"/><circle cx="${x}" cy="139" r="3" fill="#E9EEFF"/>`; });
      return s;
    },

    registration(spec, r) {
      let s = '<rect width="320" height="200" fill="#F4F6FD"/>' +
        '<rect x="196" y="14" width="108" height="34" rx="3" fill="#2449D8"/>' +
        '<text x="250" y="37" text-anchor="middle" fill="#fff" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="17">Registration</text>';
      spec.cast.forEach((who, i) => { s += person(resolve(who, r), [100, 206][i] + jitter(r, 4), 94 + r() * 5, 1.05); });
      return s + '<rect y="138" width="320" height="6" fill="#2449D8"/><rect y="144" width="320" height="56" fill="#152358"/>' +
        [36, 62, 242, 268].map((x) => `<rect x="${x}" y="126" width="18" height="12" rx="1" fill="#fff"/>`).join('');
    },

    group(spec, r) {
      const has = (who) => (spec.with || []).includes(who);
      let s = '<rect width="320" height="200" fill="#FFE08B"/>' +
        '<rect x="20" y="12" width="280" height="40" rx="3" fill="#2449D8"/>' +
        '<text x="160" y="40" text-anchor="middle" fill="#fff" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="20">Northline Product Conference</text>' +
        '<rect y="160" width="320" height="40" fill="#F2CF68"/>';
      for (let i = 0; i < 7; i++) {
        const who = i === 4 && has('marko') ? 'marko' : null;
        s += person(resolve(who, r), 40 + i * 40, 92, 0.6, { badge: false });
      }
      for (let i = 0; i < 6; i++) {
        const who = i === 1 && has('olena') ? 'olena' : null;
        s += person(resolve(who, r), 60 + i * 40, 128, 0.66);
      }
      return s;
    }
  };

  function scene(spec, seed) {
    return SCENES[spec.type](spec, random(seed));
  }

  function portrait(who) {
    return '<rect width="120" height="120" fill="#E9EEFF"/><circle cx="98" cy="20" r="30" fill="#FFE08B" opacity=".6"/>' +
      person(CAST[who], 60, 90, 1.7, { badge: false });
  }

  function svg(inner, opts = {}) {
    const a11y = opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true"';
    return `<svg viewBox="${opts.box || '0 0 320 200'}" preserveAspectRatio="${opts.fit || 'xMidYMid meet'}" ${a11y} focusable="false">${inner}</svg>`;
  }

  window.Scenes = { CAST, scene, portrait, svg };
})();
