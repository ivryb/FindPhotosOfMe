/* Illustrated sample imagery for the Keepsake concept.
   Every scene is drawn inline, so the pictures survive without network access.
   The sample attendee (curly bun, round glasses, ochre jacket) is the only
   person marked as a match, and nobody else in the crowd shares that look. */
(function () {
  const INK = '#30263B';
  const SAMPLE = { skin: '#C98E66', hair: '#2A1E2E', style: 'bun', top: '#D49A3A', glasses: true };
  const CROWD = [
    { skin: '#F1C9A5', hair: '#5A3B2A', style: 'short', top: '#6B7FA6' },
    { skin: '#A86F4C', hair: '#1F1A22', style: 'long', top: '#7E9C88' },
    { skin: '#E8B795', hair: '#B98F5E', style: 'long', top: '#C98A9B' },
    { skin: '#7A4E33', hair: '#1F1A22', style: 'short', top: '#3D4A6B' },
    { skin: '#D9A47E', hair: '#8C8590', style: 'side', top: '#9A8FA6' },
    { skin: '#F3D1B5', hair: '#F3D1B5', style: 'none', top: '#5E7A70' },
    { skin: '#B07A55', hair: '#2B2230', style: 'side', top: '#B6A6CF' },
  ];
  const TORSO = 'M-15 0V-17C-15-25.5-9-29 0-29S15-25.5 15-17V0Z';
  const pick = (v, n) => CROWD[(v + n) % CROWD.length];

  function hairBack(p) {
    if (p.style === 'long') return `<path d="M-11.5-40C-11.5-54 11.5-54 11.5-40V-27H-11.5Z" fill="${p.hair}"/>`;
    if (p.style === 'bun') return `<circle cy="-53" r="6" fill="${p.hair}"/>`;
    return '';
  }

  function hairFront(p) {
    const f = `fill="${p.hair}"`;
    switch (p.style) {
      case 'bun':
        return `<path d="M-10-39C-11-50-5-52.5 0-52.5S11-50 10-39C8.5-45 4-47 0-47S-8.5-45-10-39Z" ${f}/><circle cx="-9" cy="-44" r="3" ${f}/><circle cx="9" cy="-44" r="3" ${f}/>`;
      case 'long':
        return `<path d="M-9.8-40C-10-50-4-52 0-52S10-50 9.8-40C7-46 2-47.5-3-46.5S-8-43-9.8-40Z" ${f}/>`;
      case 'short':
        return `<path d="M-9.6-41C-10-50-4-52.5 1-52S10.5-48 9.6-41C8-46 3-47.5-1-47S-7.5-45.5-9.6-41Z" ${f}/>`;
      case 'side':
        return `<path d="M-9.8-40C-10-51 2-54 9.8-44L9.7-40C6-46-3-48-9.8-40Z" ${f}/>`;
      default:
        return '';
    }
  }

  // A front-facing person anchored at the bottom of the torso.
  function person(p, x, y, s = 1, o = {}) {
    const glasses = p.glasses
      ? `<g fill="none" stroke="${INK}" stroke-width="1.1"><circle cx="-3.7" cy="-41" r="3.1"/><circle cx="3.7" cy="-41" r="3.1"/><path d="M-.6-41.4H.6"/></g>`
      : '';
    const badge = o.badge === false
      ? ''
      : '<path d="M-6.5-28.5L-2.5-15M6.5-28.5L2.5-15" stroke="#7E5A99" stroke-width="1.3" fill="none"/><rect x="-5" y="-16" width="10" height="12" rx="1.4" fill="#fff"/><rect x="-5" y="-16" width="10" height="3.4" rx="1.2" fill="#4A245D"/>';
    const cup = o.cup
      ? '<rect x="7" y="-13" width="5.5" height="7" rx="1.2" fill="#fff"/><rect x="7" y="-11" width="5.5" height="2" fill="#B6A6CF"/>'
      : '';
    return `<g transform="translate(${x} ${y}) scale(${s})">${hairBack(p)}<rect x="-3.2" y="-33" width="6.4" height="6" fill="${p.skin}"/><path d="${TORSO}" fill="${p.top}"/><circle cy="-41" r="9.5" fill="${p.skin}"/>${hairFront(p)}<circle cx="-3.5" cy="-41" r="1.05" fill="${INK}"/><circle cx="3.5" cy="-41" r="1.05" fill="${INK}"/><path d="M-2.6-36.8Q0-34.8 2.6-36.8" stroke="${INK}" stroke-width=".9" fill="none" stroke-linecap="round"/>${glasses}${badge}${cup}</g>`;
  }

  // Audience member seen from behind.
  function backOf(p, x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><path d="${TORSO}" fill="${p.top}"/><circle cy="-41" r="10" fill="${p.hair}"/></g>`;
  }

  const SCENES = {
    stage(v, sample) {
      let crowd = '';
      for (let i = 0; i < 8; i++) crowd += backOf(pick(v, i + 2), 8 + i * 21, 128, 0.78);
      const slide = 30 + (v % 3) * 10;
      return `<rect width="160" height="120" fill="#3B2B48"/><ellipse cx="40" cy="64" rx="38" ry="56" fill="#5A4270" opacity=".6"/><rect x="72" y="14" width="76" height="46" rx="2" fill="#DDD1ED"/><rect x="80" y="23" width="${slide}" height="5" rx="1" fill="#4A245D"/><rect x="80" y="33" width="56" height="3" rx="1" fill="#9C88B3"/><rect x="80" y="39" width="46" height="3" rx="1" fill="#9C88B3"/><rect x="80" y="45" width="50" height="3" rx="1" fill="#9C88B3"/><rect y="86" width="160" height="34" fill="#2A1F33"/>${person(sample ? SAMPLE : pick(v, 0), 40, 88, 1.05)}<path d="M25 68H55L52 92H28Z" fill="#4A245D"/><rect x="34" y="74" width="12" height="2.6" rx="1" fill="#B6A6CF"/>${crowd}`;
    },

    conversation(v, sample) {
      const slot = v % 3;
      const wx = v % 2 ? 94 : 8;
      const px = v % 2 ? 12 : 108;
      const people = [38, 82, 126]
        .map((x, i) => person(sample && i === slot ? SAMPLE : pick(v, i), x, 128, 1.32, { cup: (i + v) % 2 === 0 }))
        .join('');
      return `<rect width="160" height="120" fill="#ECE5F3"/><rect x="${wx}" y="8" width="58" height="64" fill="#FBFAFD"/><path d="M${wx + 29} 8V72M${wx} 40H${wx + 58}" stroke="#DDD1ED" stroke-width="2"/><rect x="${px}" y="14" width="40" height="50" rx="2" fill="#B6A6CF"/><rect x="${px + 7}" y="22" width="26" height="4" fill="#4A245D"/><rect y="98" width="160" height="22" fill="#D8CDE5"/>${people}`;
    },

    group(v, sample) {
      let back = '';
      let front = '';
      [26, 54, 80, 106, 134].forEach((x, i) => { back += person(pick(v, i + 1), x, 98, 0.82); });
      [40, 67, 93, 120].forEach((x, i) => { front += person(sample && i === 1 ? SAMPLE : pick(v, i + 4), x, 124, 0.95); });
      return `<rect width="160" height="120" fill="#E6DDF0"/><rect x="20" y="8" width="120" height="20" rx="2" fill="#4A245D"/><rect x="48" y="15" width="64" height="6" rx="1" fill="#DDD1ED"/><rect y="100" width="160" height="20" fill="#D3C6E2"/>${back}${front}`;
    },

    workshop(v, sample) {
      const slot = (v + 1) % 3;
      let people = '';
      let laptops = '';
      [36, 80, 124].forEach((x, i) => {
        people += person(sample && i === slot ? SAMPLE : pick(v, i + 3), x, 112, 1.08);
        laptops += `<path d="M${x - 12} 91L${x - 9} 79H${x + 9}L${x + 12} 91Z" fill="#8F80A3"/><circle cx="${x}" cy="85" r="1.8" fill="#DDD1ED"/>`;
      });
      const notes = ['#DDD1ED', '#F3D9A4', '#C9DCCF', '#DDD1ED', '#C9DCCF']
        .map((c, i) => `<rect x="${22 + i * 14}" y="${16 + (i % 2) * 12}" width="10" height="10" fill="${c}"/>`)
        .join('');
      return `<rect width="160" height="120" fill="#F1ECF6"/><rect x="14" y="8" width="84" height="44" rx="2" fill="#fff" stroke="#CFC3DD"/>${notes}${people}<rect y="90" width="160" height="30" fill="#BBA9CF"/><rect y="90" width="160" height="4" fill="#A592BC"/>${laptops}`;
    },

    coffee(v, sample) {
      return `<rect width="160" height="120" fill="#E3DAEC"/><rect y="10" width="160" height="56" fill="#F6F3FA"/><path d="M40 10V66M80 10V66M120 10V66" stroke="#DDD1ED" stroke-width="2"/><rect x="140" y="78" width="12" height="18" fill="#8F80A3"/><ellipse cx="146" cy="70" rx="12" ry="16" fill="#7E9C88"/><rect y="104" width="160" height="16" fill="#D3C6E2"/><rect x="81" y="88" width="4" height="32" fill="#4A245D"/><rect x="71" y="84" width="24" height="4" rx="1" fill="#4A245D"/><rect x="76" y="78" width="5" height="6" rx="1" fill="#fff"/>${person(sample ? SAMPLE : pick(v, 1), 44, 126, 1.3, { cup: true })}${person(pick(v, 5), 120, 126, 1.3, { cup: v % 2 === 0 })}`;
    },

    registration(v) {
      let badges = '';
      for (let i = 0; i < 6; i++) badges += `<rect x="${12 + i * 12}" y="78" width="9" height="7" rx="1" fill="#fff"/>`;
      return `<rect width="160" height="120" fill="#EFE9F5"/><rect x="14" y="12" width="56" height="18" rx="2" fill="#4A245D"/><rect x="22" y="19" width="40" height="4" rx="1" fill="#DDD1ED"/>${person(pick(v, 2), 56, 100, 1)}<rect y="84" width="160" height="36" fill="#6B4A80"/><rect y="84" width="160" height="5" fill="#4A245D"/>${badges}${person(pick(v, 5), 122, 126, 1.3)}`;
    },
  };

  // The sample event collection. Five photos include the sample attendee.
  const PHOTOS = [
    { scene: 'registration', v: 0 },
    { scene: 'stage', v: 1 },
    { scene: 'conversation', v: 2 },
    { scene: 'conversation', v: 3, sample: true, caption: 'Between sessions' },
    { scene: 'group', v: 4 },
    { scene: 'workshop', v: 5 },
    { scene: 'coffee', v: 6 },
    { scene: 'stage', v: 2, sample: true, lead: true, caption: 'Panel talk on the main stage' },
    { scene: 'conversation', v: 1 },
    { scene: 'registration', v: 3 },
    { scene: 'workshop', v: 1, sample: true, caption: 'Afternoon workshop' },
    { scene: 'stage', v: 4 },
    { scene: 'coffee', v: 2 },
    { scene: 'group', v: 0 },
    { scene: 'group', v: 3, sample: true, caption: 'Closing group photo' },
    { scene: 'conversation', v: 5 },
    { scene: 'coffee', v: 4, sample: true, caption: 'Coffee break' },
    { scene: 'workshop', v: 6 },
  ];

  const svg = (box, inner) =>
    `<svg viewBox="${box}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${inner}</svg>`;

  function photo(i) {
    const p = PHOTOS[i];
    return svg('0 0 160 120', SCENES[p.scene](p.v, p.sample));
  }

  function selfie(blurry, id) {
    const filter = blurry ? `<defs><filter id="${id}"><feGaussianBlur stdDeviation="3.2"/></filter></defs>` : '';
    const veil = blurry ? '<rect width="120" height="120" fill="#30263B" opacity=".38"/>' : '';
    return svg(
      '0 0 120 120',
      `${filter}<g${blurry ? ` filter="url(#${id})"` : ''}><rect width="120" height="120" fill="#DDD1ED"/><circle cx="96" cy="22" r="26" fill="#EEE8F5"/>${person(SAMPLE, 60, 142, 2.3, { badge: false })}</g>${veil}`
    );
  }

  window.Keepsake = { PHOTOS, photo, selfie };
})();
