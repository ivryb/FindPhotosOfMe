/* Local-only behavior for the Keepsake preview. Nothing here uploads,
   signs in, searches faces, or sends data anywhere. */
(function () {
  const { PHOTOS, photo, selfie } = window.Keepsake;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Illustrations
  $$('[data-photo]').forEach((el) => { el.innerHTML = photo(Number(el.dataset.photo)); });
  $$('[data-selfie]').forEach((el, i) => { el.innerHTML = selfie(el.dataset.selfie === 'blurry', `blur-${i}`); });

  const album = $('#album');
  const wall = $('#wall');
  PHOTOS.forEach((p, i) => {
    album.insertAdjacentHTML('beforeend', `<li>${photo(i)}</li>`);
    const cls = ['frame', p.sample && 'is-match', p.lead && 'is-lead'].filter(Boolean).join(' ');
    wall.insertAdjacentHTML(
      'beforeend',
      `<li class="${cls}" style="view-transition-name: frame-${i}">${photo(i)}<span class="visually-hidden">Sample photo ${i + 1}</span></li>`
    );
  });

  // Demo
  const demo = $('#demo');
  const steps = $$('[data-step]', demo);
  const bars = $$('.progress span', demo);
  const wallNote = $('#wall-note');
  const wallDefault = wallNote.textContent;
  const status = $('#search-status');
  const resultTitle = $('#result-title');
  const results = $('#results');
  const downloadNote = $('#download-note');
  const afterMatch = $('#after-match');
  const afterEmpty = $('#after-empty');
  const matches = PHOTOS.map((p, i) => ({ ...p, i })).filter((p) => p.sample).sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0));
  let timer;

  results.innerHTML = matches
    .map((p) => `<li><span class="results__thumb">${photo(p.i)}</span><span class="results__caption">${p.caption}</span><button class="btn btn--outline btn--xs" type="button" data-download="${p.caption}">Download</button></li>`)
    .join('');

  function show(n, focus) {
    steps.forEach((s) => { s.hidden = s.dataset.step !== String(n); });
    bars.forEach((b, i) => b.classList.toggle('is-done', i < n));
    if (focus) $(`[data-step="${n}"] [data-focus]`, demo).focus({ preventScroll: true });
  }

  function morph(update) {
    if (!document.startViewTransition || reduceMotion.matches) return update();
    document.startViewTransition(update);
  }

  function search() {
    const blurry = $('input[name="selfie"]:checked', demo).value === 'blurry';
    clearTimeout(timer);
    resultTitle.textContent = 'Searching';
    status.textContent = 'Searching this event’s photos.';
    wallNote.textContent = 'Searching this event’s photos.';
    results.hidden = true;
    afterMatch.hidden = true;
    afterEmpty.hidden = true;
    downloadNote.textContent = '';
    wall.classList.add('is-searching');
    show(4, true);

    timer = setTimeout(() => {
      wall.classList.remove('is-searching');
      if (blurry) {
        resultTitle.textContent = 'No matches yet';
        status.textContent = 'No matches yet? Try a clearer selfie or check back when more photos are available.';
        wallNote.textContent = 'No likely matches for this sample photo. The collection is unchanged.';
        afterEmpty.hidden = false;
        return;
      }
      morph(() => wall.classList.add('is-narrowed'));
      resultTitle.textContent = 'Your likely matches';
      status.textContent = `${matches.length} sample matches. Review them before downloading.`;
      wallNote.textContent = `Narrowed to ${matches.length} sample matches from ${PHOTOS.length} illustrated photos.`;
      results.hidden = false;
      afterMatch.hidden = false;
    }, reduceMotion.matches ? 300 : 1100);
  }

  function reset() {
    clearTimeout(timer);
    morph(() => wall.classList.remove('is-narrowed', 'is-searching'));
    wallNote.textContent = wallDefault;
    downloadNote.textContent = '';
    $('input[value="clear"]', demo).checked = true;
    show(1, true);
  }

  demo.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) show(Number(go.dataset.go), true);
    if (e.target.closest('[data-reset]')) reset();
    const dl = e.target.closest('[data-download]');
    if (dl) downloadNote.textContent = `Downloads are turned off in this preview. In the live product, this saves “${dl.dataset.download}” to your device.`;
  });
  $('#search').addEventListener('click', search);

  // Compact header: below 820px the nav collapses behind a Menu button.
  const header = $('.site-header');
  const menuBtn = $('.menu-toggle');
  const compact = window.matchMedia('(max-width: 820px)');
  function setMenu(open) {
    header.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }
  header.classList.add('has-menu');
  menuBtn.hidden = false;
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $('#site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (header.classList.contains('is-open') && !header.contains(e.target)) setMenu(false);
  });
  compact.addEventListener('change', () => setMenu(false));

  // Every "Explore the demo" control scrolls to the demo and hands focus to it.
  const dialog = $('#preview-dialog');
  $$('[data-explore]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      setMenu(false);
      if (dialog.open) dialog.close();
      demo.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
      const current = steps.find((s) => !s.hidden);
      const target = current.dataset.step === '1' ? $('[data-go="2"]', current) : $('[data-focus]', current);
      target.focus({ preventScroll: true });
      history.replaceState(null, '', '#demo');
    });
  });

  // Prototype event creation only opens an honest dialog.
  $$('[data-preview]').forEach((el) => el.addEventListener('click', () => dialog.showModal()));

  // Organizer dashboard illustration
  const dash = $('#dash');
  const pill = $('#dash-pill');
  const detail = $('#dash-detail');
  const copyBtn = $('#copy-link');
  const copyNote = $('#copy-note');
  const link = $('#share-link');

  $$('[data-dash]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ready = btn.dataset.dash === 'ready';
      dash.dataset.state = btn.dataset.dash;
      $$('[data-dash]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      pill.textContent = ready ? 'Ready to share' : 'Preparing photos';
      detail.textContent = ready ? '18 sample photos prepared.' : '12 of 18 sample photos prepared.';
      copyBtn.disabled = !ready;
      copyNote.textContent = ready ? '' : 'Share the link once the event is ready.';
    });
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      copyNote.textContent = 'Sample link copied. It doesn’t open a real event.';
    } catch {
      link.select();
      copyNote.textContent = 'Copying isn’t available here. The link is selected so you can copy it yourself.';
    }
  });
})();
