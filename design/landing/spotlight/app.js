/* Spotlight interactions: draws the sample scenes, runs the illustrative demo,
   and opens the design-preview dialog. Nothing leaves the page. */
(function () {
  'use strict';

  const { CAST, scene, portrait, svg } = window.Scenes;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel) => document.querySelector(sel);

  // Fixed sample program. Olena and Marko each appear in five photos, together in two.
  const SESSIONS = [
    { time: '09:00', title: 'Registration', photos: [
      { type: 'registration', cast: [null, null], alt: 'two attendees at the registration desk' },
      { type: 'talk', cast: ['olena', null], alt: 'Olena talking with another attendee by the windows' },
      { type: 'coffee', cast: [null, 'marko'], alt: 'Marko and another attendee at the coffee counter' }
    ] },
    { time: '10:00', title: 'Opening keynote', photos: [
      { type: 'stage', speaker: 'olena', alt: 'Olena speaking on the main stage' },
      { type: 'stage', speaker: null, alt: 'a speaker on the main stage in front of the audience' },
      { type: 'talk', cast: [null, null, null], alt: 'three attendees talking after the keynote' }
    ] },
    { time: '11:30', title: 'Morning breakouts', photos: [
      { type: 'talk', cast: ['marko', 'olena'], alt: 'Marko and Olena in conversation' },
      { type: 'workshop', cast: [null, null], alt: 'two attendees at laptops in a breakout room' },
      { type: 'workshop', cast: [null, null, null], alt: 'three attendees in a breakout session' }
    ] },
    { time: '13:00', title: 'Lunch', photos: [
      { type: 'coffee', cast: ['olena', null], alt: 'Olena at the coffee counter over lunch' },
      { type: 'coffee', cast: [null, null], alt: 'two attendees at the coffee counter' },
      { type: 'talk', cast: [null, 'marko'], alt: 'Marko chatting with another attendee' }
    ] },
    { time: '14:30', title: 'Afternoon workshops', photos: [
      { type: 'workshop', cast: ['marko', null, null], alt: 'Marko working with two attendees in a workshop' },
      { type: 'talk', cast: [null, null], alt: 'two attendees talking between workshops' },
      { type: 'coffee', cast: [null, null], alt: 'two attendees on an afternoon coffee break' }
    ] },
    { time: '17:30', title: 'Closing and group photo', photos: [
      { type: 'stage', speaker: null, alt: 'the closing talk on the main stage' },
      { type: 'group', with: ['olena', 'marko'], alt: 'the closing group photo, with Olena and Marko among everyone' },
      { type: 'talk', cast: [null, null, null], alt: 'three attendees saying goodbye' }
    ] }
  ];
  const PHOTOS = SESSIONS.flatMap((s) => s.photos);
  const seedOf = (photo) => 1000 + PHOTOS.indexOf(photo);
  const peopleIn = (p) => [...(p.cast || []), p.speaker, ...(p.with || [])].filter(Boolean);

  /* Hero strip */
  const STRIP = [
    { spec: { type: 'stage', speaker: null }, tag: 'Main stage' },
    { spec: { type: 'talk', cast: [null, null, null] }, tag: 'Between sessions' },
    { spec: { type: 'group', with: [] }, tag: 'Group photo' },
    { spec: { type: 'workshop', cast: [null, null, null] }, tag: 'Workshop' },
    { spec: { type: 'coffee', cast: [null, null] }, tag: 'Coffee break' }
  ];
  $('[data-strip]').innerHTML = STRIP.map((f, i) =>
    `<li style="--i:${i}">${svg(scene(f.spec, 100 + i), { fit: 'xMidYMid slice' })}<span class="frame-tag">${f.tag}</span></li>`
  ).join('');

  /* Problem: a dense contact sheet that contains four of Olena's demo photos */
  const olenaPhotos = PHOTOS.filter((p) => peopleIn(p).includes('olena')).slice(0, 4);
  const sheetSlots = { 6: olenaPhotos[0], 17: olenaPhotos[1], 23: olenaPhotos[2], 34: olenaPhotos[3] };
  const fillers = ['talk', 'coffee', 'workshop', 'stage', 'registration', 'talk', 'group'];
  let sheet = '';
  for (let i = 0; i < 42; i++) {
    const own = sheetSlots[i];
    const type = fillers[i % fillers.length];
    const spec = own || { type, speaker: null, with: [], cast: i % 3 ? [null, null] : [null, null, null] };
    if (!own && type === 'registration') spec.cast = [null, null];
    sheet += `<li>${svg(scene(spec, own ? seedOf(own) : 300 + i), { fit: 'xMidYMid slice' })}</li>`;
  }
  $('[data-sheet]').innerHTML = sheet;
  $('[data-focus]').innerHTML = olenaPhotos.map((p) => `<li>${svg(scene(p, seedOf(p)), { fit: 'xMidYMid slice' })}</li>`).join('');

  /* Use-case art */
  $('[data-use-art]').innerHTML = svg(scene({ type: 'stage', speaker: null }, 77), {
    fit: 'xMidYMid slice', label: 'Illustration: a speaker on a conference stage with the audience in front'
  });

  /* Demo */
  const program = $('[data-program]');
  const statusEl = $('[data-status]');
  const countEl = $('[data-count]');
  const searchBtn = $('[data-search]');
  const results = $('[data-results]');
  const resultGrid = $('[data-result-grid]');
  const resultsTitle = $('[data-results-title]');
  const selfie = $('[data-selfie]');
  const total = PHOTOS.length;
  let who = 'olena';
  let timer = null;

  $('[data-sessions]').innerHTML = SESSIONS.map((session) => {
    const frames = session.photos.map((p) =>
      `<li class="frame" data-people="${peopleIn(p).join(' ')}">${svg(scene(p, seedOf(p)), { label: 'Sample photo: ' + p.alt })}<span class="frame-match">Likely match</span></li>`
    ).join('');
    return `<li class="session"><p class="session-label"><span class="session-time">${session.time}</span> <span class="session-title">${session.title}</span></p><ul class="session-photos">${frames}</ul></li>`;
  }).join('');
  const frames = [...program.querySelectorAll('.frame')];
  const sessions = [...program.querySelectorAll('.session')];

  document.querySelectorAll('[data-face]').forEach((el) => {
    el.innerHTML = svg(portrait(el.dataset.face), { box: '0 0 120 120', fit: 'xMidYMid slice' });
  });

  function showSelfie() {
    selfie.innerHTML = svg(portrait(who), {
      box: '0 0 120 120', fit: 'xMidYMid slice', label: `Sample selfie: illustrated portrait of ${CAST[who].name}`
    }) + '<span class="selfie-tag">Sample selfie</span>';
  }

  function reset() {
    clearTimeout(timer);
    timer = null;
    program.classList.remove('is-searching', 'is-narrowed');
    frames.forEach((f) => f.classList.remove('is-match', 'is-other'));
    sessions.forEach((s) => s.classList.remove('has-match'));
    results.hidden = true;
    resultGrid.innerHTML = '';
    searchBtn.disabled = false;
    statusEl.textContent = `Ready to search ${total} sample photos.`;
    countEl.textContent = `Whole event: ${total} sample photos`;
  }

  function showResults() {
    timer = null;
    const name = CAST[who].name;
    const matches = PHOTOS.filter((p) => peopleIn(p).includes(who));
    frames.forEach((f) => {
      const hit = f.dataset.people.split(' ').includes(who);
      f.classList.toggle('is-match', hit);
      f.classList.toggle('is-other', !hit);
    });
    sessions.forEach((s) => s.classList.toggle('has-match', !!s.querySelector('.is-match')));
    program.classList.remove('is-searching');
    program.classList.add('is-narrowed');

    resultsTitle.textContent = `${name}’s likely matches`;
    resultGrid.innerHTML = matches.map((p, i) =>
      `<li style="--i:${i}">${svg(scene(p, seedOf(p)), { fit: 'xMidYMid slice', label: 'Sample match: ' + p.alt })}</li>`
    ).join('');
    results.hidden = false;
    searchBtn.disabled = false;
    countEl.textContent = `${name}’s likely matches: ${matches.length} of ${total} sample photos`;
    statusEl.textContent = `Illustrative result: ${matches.length} likely matches for ${name}. Review them before downloading.`;
  }

  searchBtn.addEventListener('click', () => {
    reset();
    searchBtn.disabled = true;
    program.classList.add('is-searching');
    statusEl.textContent = 'Searching this event’s photos.';
    countEl.textContent = `Searching ${total} sample photos`;
    timer = setTimeout(showResults, reduceMotion.matches ? 250 : 1100);
  });

  document.querySelectorAll('input[name="who"]').forEach((input) => {
    input.addEventListener('change', () => {
      who = input.value;
      showSelfie();
      reset();
    });
  });

  $('[data-reset]').addEventListener('click', () => {
    reset();
    searchBtn.focus();
  });

  $('[data-download]').addEventListener('click', () => {
    statusEl.textContent = 'Downloads are turned off in this illustrative demo. In the live flow, you download the photos you want to keep.';
  });

  showSelfie();
  reset();

  /* Explore the demo: scroll to it and move focus to its heading */
  function goToDemo(event) {
    if (event) event.preventDefault();
    const heading = $('#demo-title');
    $('#demo').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
    history.replaceState(null, '', '#demo');
  }
  document.querySelectorAll('[data-demo-link]').forEach((link) => link.addEventListener('click', goToDemo));

  /* Preview dialog for event-creation actions */
  const dialog = $('#preview-dialog');
  document.querySelectorAll('[data-create]').forEach((btn) => btn.addEventListener('click', () => dialog.showModal()));
  $('[data-dialog-close]').addEventListener('click', () => dialog.close());
  $('[data-dialog-demo]').addEventListener('click', () => {
    dialog.close();
    goToDemo();
  });
})();
