# Keepsake: design rationale

Keepsake is one of three landing-page concepts for FindPhotosOfMe (see `docs/landing-page-brief.md`). This one is human, photographic, and quietly premium. It is a local, static prototype: open `index.html` directly. No build step, no dependencies, no uploads, accounts, payments, or contact submissions.

## Authorship

- **Claude (first session):** design plan, critique, and most of the build: page structure and copy, `styles.css`, `art.js` illustrations, `app.js` demo behavior, and the first version of this file. That session ended at a usage limit before the review feedback was addressed.
- **Codex (interim, with root authorization):** after a browser review found the first hero too close to Gather (same headline, split illustrated hero), Codex replaced the hero with the headline “You were there. Find the photos to keep.”, cached two Unsplash photos locally in `assets/`, and centered the hero copy above a two-photo composition in `styles.css`. Root browser review then confirmed that hero looks good and distinct, and both photos load.
- **Claude (this session):** kept the Codex hero composition, then reworded its stock caption, fixed the hidden-attribute bug, added the compact mobile header, corrected the footer imagery note, and rewrote this file.

## Design plan

- **Color:** the brief's palette. Pale lilac `#F5F2FA` for the page, white `#FFFFFF` for paper and photo mats, plum `#4A245D` for actions and headings, ink `#30263B` for text, lavender `#DDD1ED` for structure, muted `#65576D` for supporting text. Ochre `#D49A3A` appears in one place only: the sample attendee's jacket in the illustrations, so that person stands out in every scene.
- **Type:** Fraunces (500–600, set at 550) for every heading, the founder narrative, and the FAQ questions. DM Sans for reading and interface text. Fallbacks are Iowan Old Style / Palatino / Georgia and Avenir Next / Segoe UI / system-ui.
- **Scale:** h1 40→76px / 1.06, h2 34→46px, body 18px / 1.65, supporting text 14px or larger. The serif narrative gets 1.6 line height.
- **Layout:** the hero is centered, the only centered section. A short serif headline sits over two real event-mood photographs, offset in height and bottom-aligned. Everything after it is left-aligned and alternates wide visual stories with compact explanations on lilac and white, with a plum founder band and a closing plum panel.
- **Memorable element:** a contact sheet becoming a personal set. The demo wall of 18 illustrated photos narrows, when the reader acts, into a composed set of the five photos the sample attendee appears in, with the stage moment as the lead print.

### Current wireframe

```
header      brand ............ nav ........ [Explore the demo]
            (≤820px: brand ... [Explore the demo] [Menu]; ≤480px: brand ... [Menu])
hero              You were there. / Find the photos to keep.
                  lede (organizer context) / CTA / supporting line
            [ gathering.jpg, wide        ] [ conversation.jpg ]
                         small stock caption
problem     [shared album 6×3 ......]  [problem copy]
demo        [wall 6×3 → composed set]  [phone: event → sign in → selfie → matches]
how         1 ─────  2 ─────  3 ─────
organizers  [copy + photographers]     [dashboard + status toggle]
who         [two offset prints]        [conference lead]
            [meetups] [hackathons] [running: pilot idea]
compare     table
story       plum band, serif narrative
pricing     [model copy]               [ticket: organizers | attendees / CTA]
trust       [how search works]         [answered before launch]
faq         [heading]                  [details × 8]
final       plum panel: copy + three kept prints
```

The first plan, now superseded, had a left-aligned split hero with matted illustrated prints on the right. Review found it too close to Gather.

## Critique against the brief and the skill

1. **Hero differentiation.** Gather and Spotlight both lead with product-shaped visuals. Keepsake now leads with people at an event and an attendee-voiced headline. The organizer offer stays in the lede (“Upload your collection, share one link…”) and the supporting line, so a buyer can still explain the offer within five seconds.
2. **Stock as mood, illustration as proof.** The stock photos set the tone but can't show one consistent person across a selfie and results. They never appear in the matching demo. Every matching scene is inline SVG (`art.js`) with one consistently drawn sample attendee, labelled “Illustrative demo”.
3. **One transformation.** The problem section shows only the dense album. The demo narrows that same album, but only when the reader starts the search. There's no static before/after.
4. **Template chrome.** There are no eyebrow labels, all-caps labels, `→` in buttons, or middle-dot meta strings. Numbers appear only for real sequences: the three organizer steps and “Step n of 4”. Radii follow hierarchy: photos and prints 6px, panels 20px, phone 36px, pill buttons.
5. **Scrapbook risk.** No rotation, tape, polaroids, or script type. Prints sit on white mats with soft plum shadows.
6. **Motion.** The page has one user-triggered moment: the wall narrowing, using View Transitions where available and an instant change elsewhere. There are no load or scroll reveals. Reduced motion skips the transition and shortens the sample delay.
7. **Honest controls.**
   - *Explore the demo* (header, mobile menu, hero, problem, pricing, final, dialog) closes the menu if it's open, scrolls to the demo, and focuses its current action.
   - The demo includes sign-in (“Continue as sample attendee”; no account is created). The “Dim, blurry photo” choice shows the empty state. *Download* explains that downloads are off in the preview.
   - *Create an event* opens a dialog saying nothing is created or charged.
   - The dashboard toggle previews “Preparing photos” and “Ready to share”. *Copy link* copies a reserved `.example` URL.
   - The page has no forms, policy links, logos, testimonials, ratings, tier prices, or speed or accuracy figures.

## Refinements in this session

- **Hidden state.** `.results { display: grid }` overrode the browser's built-in `[hidden]` rule, so the empty results list still took up layout while searching and in the empty state. A global `[hidden] { display: none !important; }` now restores it. Audit of every element that can be hidden: demo `.step`s (no display rule), `#results` (grid, now fixed), `#after-match` and `#after-empty` (no display rule), and the new `.menu-toggle` (inline-flex on mobile, kept hidden without JavaScript). The class-based states `.wall.is-narrowed .frame:not(.is-match)` and `.download-note:empty` don't use the attribute and are unaffected. The demo's behavior is otherwise unchanged.
- **Compact mobile header.** At 375px the header had wrapped to about 150px. With JavaScript, at 820px and below it is now one row about 60px tall. That row holds the brand and a real `Menu` button (`aria-expanded`, `aria-controls="site-nav"`). The button opens the nav as an overlay panel under the header, so content doesn't jump. Choosing a link, pressing Escape (focus returns to the button), clicking outside, or crossing the breakpoint closes it. At 480px and below the header CTA moves into the menu, since the hero CTA is already in view. Without JavaScript the button stays hidden and the nav wraps as before. Scroll offsets now match the shorter header.
- **Caption and footer.** The hero caption now reads “Stock photos from Unsplash, shown for atmosphere. The matching demo below uses illustrated sample photos.” The footer had said all pictures were illustrated. It now names the two hero photos as stock and not customer results.

## Narrative (12 sections)

Hero → familiar problem → attendee demo (with sign-in) → organizer process (with a validation note) → organizer value with dashboard and photographer note → use cases (conference first, meetups, hackathons, running marked “Pilot idea” with no bib search) → alternatives table → founder story (attributed, explicitly not an endorsement) → pricing model (“Launch pricing is being finalized”, no tiers or numbers) → trust and expectations (with what must be answered before launch) → 8 FAQs → final invitation, then a footer with the design-preview note.

## Asset notes

- **`assets/gathering.jpg`** (1200×800): people sharing a meal around a long table. Source: https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85
- **`assets/conversation.jpg`** (1200×800): people discussing ideas in a gallery or community space. Source: https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=85
- Both were visually inspected and cached locally by Codex, so the page needs no image network requests. License: Unsplash License, https://unsplash.com/license. These photos are **mood only**. They aren't face-match evidence or customer results, and the page says so in the hero caption and footer. Production evidence still needs permissioned event imagery.
- **Illustrations:** drawn in `art.js` as inline SVG. The sample collection has 18 scenes. The sample attendee (curly bun, round glasses, ochre jacket) appears in five of them, and nobody else in the crowd shares that combination. The selfie is a close-up of the same illustrated person. “18 photos” and “5 matches” are demo data and are labelled as such.
- **Fonts:** Fraunces and DM Sans from Google Fonts, the only network dependency. If the fonts fail, the fallback stacks take over and nothing structural depends on them.
- No HeadshotPro assets and no event logos.

## Files

- `index.html`: semantic structure and all copy.
- `styles.css`: tokens, layout, responsive rules (960 / 820 / 640 / 480px), hidden guard, reduced motion.
- `art.js`: illustration generator and sample collection data.
- `app.js`: demo state, mobile menu, dialog, dashboard toggle, and copy behavior (all local).
- `assets/gathering.jpg`, `assets/conversation.jpg`: cached Unsplash mood photos.

## Known limitations

- This session's changes were reviewed only at source level. I haven't rendered the page or run its JavaScript. Browser checks of the menu, the hidden fix, and the 375px header height belong to the separate Codex/root validation.
- Illustrations render from JavaScript, so with JavaScript off the illustrated areas are blank. The hero photos, copy, anchors, wrapped nav, and FAQ still work.
- The selected-selfie style uses `:has()`. Older browsers show the native radio state instead.
- The narrowing animation needs View Transitions support. Other browsers get an instant change that is still correct.
