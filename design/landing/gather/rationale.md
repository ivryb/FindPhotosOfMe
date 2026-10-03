# Gather: design rationale

Gather is one of three local landing-page concepts for FindPhotosOfMe (see `docs/landing-page-brief.md`). It is bright, clear, and organizer-friendly. Its memorable element is a collection of event photos that **you** narrow down to one attendee's photos.

Files: `index.html`, `styles.css`, `app.js`. Plain HTML, CSS, and JavaScript. No build step and no dependencies.

## Design plan (first pass)

- **Color:** the brief's palette, unchanged. Paper `#FFFFFF`, ink `#172C30`, spruce `#196657`, mist `#EAF3F0`, soft lemon `#F4DC79`, muted text `#526366`. Also a derived spruce-deep `#134F44` for hover and a line tint `#CFDFDA`.
- **Type:** Manrope throughout. Display at 700 with tight tracking, body at 400–600. The fallback stack is Avenir Next, Segoe UI, system-ui: humanist or geometric sans faces with similar widths. The hero is fluid and caps at 64px. Each of its three sentences gets its own line, like event signage. Section headings run 32–48px, body text is 18px/1.6, and supporting text stays at 14px or larger.
- **Layout:** an asymmetric hero, with copy on the left and the live sample collection on the right. After that, wide visual stories alternate with compact explanations.

```
┌───────────────────────────────────────────────┐
│ Your event.        │ ┌ Northline (sample) ──┐ │
│ Their photos.      │ │ (o) Mira   [Search]  │ │
│ One selfie away.   │ │ ▦▦▦▦▦▦ ▦▦▦▦▦▦         │ │
│ lede               │ │ ▦▦▦▦▦▦ ▦▦▦▦▦▦  → 5   │ │
│ [Explore] [How]    │ └──────────────────────┘ │
├───────────────────────────────────────────────┤
│ problem copy        │ scrollable shared album  │  (mist)
│ 1 ── 2 ── 3  organizer route                  │
│ attendee steps      │ phone with Mira's results│  (mist)
│ dashboard (states)  │ organizer copy           │
│ wide conference scene + 3 quieter use cases   │
│ comparison table                              │  (mist)
│ chat-bot illustration │ founder story         │
│ pricing copy        │ one event "ticket"       │
│ expectations │ to be published before launch  │  (mist)
│ FAQ (details)                                 │
│ final invitation (spruce) / footer (ink)      │
└───────────────────────────────────────────────┘
```

- **Alignment:** text is left-aligned everywhere. The final invitation is the one centered moment.
- **Principles:** (1) the demo is the explanation, so it sits in the hero and the pointer moves the collection; (2) lemon has a single meaning: Mira's selfie ring and her matched photos; (3) every number on the page is labeled as sample data; (4) every control does something real and local.

## Critique against the brief and the skill

Where the first draft leaned on defaults, and what changed:

1. **Lemon as a generic accent.** It was going to be used for tags, buttons, and highlights. That is the "one bright accent everywhere" tell, and it also blurs meaning. **Revised:** lemon means "the one person found in the collection". It appears on Mira's selfie ring, her matched tiles, the phone results, her earrings, the FindPhotosOfMe row in the comparison, and the single lemon cell in the logo mark. The only functional exception is the focus outline on dark spruce/ink surfaces (final section, ticket, footer), where spruce would be invisible. Tags are white with a dashed outline instead.
2. **Use cases as four identical rounded cards.** That is the SaaS-card kit. **Revised:** conferences get one wide stage scene and an h2, because they are the first buyer. Meetups, hackathons, and the exploratory sports pilot follow as a quiet list with no card chrome.
3. **Pricing as a three-tier grid with proposed prices.** The brief prefers the pricing model over numbers, and tiers invite "Most popular" styling. **Revised:** a single event "ticket" that says who pays, what it covers, that attendees search free, and that there is no planned subscription. The stub reads "Launch pricing is being finalized." Its button opens an honest preview dialog. A ticket stub also fits the event setting.
4. **Stock mood photos in the hero.** Unrelated stock faces next to a "match" would contradict the demo. **Revised:** every scene is inline SVG drawn by one `person()` function. Mira (bun, round glasses, blue top, lemon earrings) is the only figure with those traits, so she reads as the same person across the selfie, the hero results, the phone, and the founder-chat illustration.
5. **Eyebrows and numbering.** I removed a "Conferences come first" label above the use-case heading. Numbers appear only where the content is a sequence: the organizer route and the attendee steps.
6. **Scattered motion.** There are no scroll reveals. The one choreographed moment is user-triggered: non-matching tiles dim, then the matching tiles move into a larger layout (FLIP via the Web Animations API). With reduced motion on, the change is instant.

## Sections (12)

1. Hero with the illustrative demo. 2. The familiar problem, next to a scrollable 40-photo sample album. 3. The organizer route: upload, prepare, share. 4. The attendee flow (open link, **sign in**, add a selfie, download) with a phone at realistic size, toggling between results and the no-matches state. 5. Organizer value, with an illustrative dashboard that toggles Preparing photos / Ready to share and a copyable example.com link, plus a photographer note. 6. Use cases: conference first; meetups, hackathons, and running events marked as an exploratory pilot with no bib search. 7. Comparison table (ZIP / shared album / FindPhotosOfMe). 8. Founder story, attributed to Ivan, marked as his own account rather than a testimonial, beside an illustration of the original chat-bot flow. 9. Pricing model. 10. Trust and practical expectations, including a list of what must be published before launch. 11. Eight FAQs in native `<details>`, with the selfie-storage answer marked as a preview note. 12. Final invitation, and a footer with a design-preview note.

## Control behavior

- **Explore the demo** (header, hero, final section): scrolls the demo to the center of the screen, moves focus to the demo button, and runs the narrowing once.
- **Search with this selfie / Show all 24 photos:** toggles the narrowing. The status line (`aria-live`) reads “Searching this event’s photos.” and then reports 5 likely matches with the imperfect-matches caveat. Tiles hidden by the filter get `hidden`, so screen readers follow what is on screen.
- **See how it works** and the nav links are in-page anchors. On mobile, the nav collapses behind a Menu button (aria-expanded, closes on Escape).
- **Download** (phone), **Try another photo**, and **Preview event setup** open a native `<dialog>` that says this is a design preview and nothing is downloaded, uploaded, created, or paid.
- **Copy sample link** copies `https://example.com/e/northline-product-day` and says it is not a real event. If the clipboard is unavailable, it selects the text and says so.
- There are no forms, sign-up fields, checkout, policy links, logos, testimonials, or performance numbers.

## Asset notes

- **Illustrations:** every event scene (stage, conversation, group photo, registration, panel, audience, coffee break, workshop, finish line) and Mira's selfie are inline SVG generated in `app.js`. No external images and no stock photos. No HeadshotPro assets.
- **Sample data:** “Northline Product Day” is a made-up event, and all counts (24, 40, 240, 150 of 240, 5 matches) are labeled as sample or illustrative where they appear.
- **Color outside the palette:** illustration-only skin, hair, and clothing tones. Mira's blue top `#3D62B3` is deliberately absent from every other figure.
- **Network dependency:** only Manrope from Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`). If it fails, the fallback stack keeps a similar sans-serif rhythm. Every structural visual is local.
- **No JavaScript:** the page text, FAQ, and anchors still work. The illustrated scenes stay empty as tinted placeholders, and the demo shows a `<noscript>` note.
- **Before launch:** replace the illustrations with permissioned event photography where appropriate. Connect Create an event only after onboarding is validated, and add real contact details and policies.

## Final source review (this pass)

Root browser review reported a clean layout at 1440px and 375px, no horizontal overflow, five demo matches, and a working mobile menu, so the direction was kept as built. This pass was a source-level read only, with small fixes:

- **Hidden state:** `[hidden] { display: none !important; }` sits ahead of every component rule, so explicit layouts (`.phone__empty { display: grid }`, the dashboard panels, filtered demo tiles) cannot reveal elements that the demo state has hidden. The JavaScript toggles only the `hidden` attribute for state; it never sets inline `display`.
- **Anchors:** `#main`, `#top`, `#demo`, `#how`, `#who`, `#pricing`, `#questions` all exist. There are no local image, font, or script files beyond `styles.css` and `app.js`, and both are present.
- **Contrast:** the busy-state demo button was `#4E8578` with white text (about 4.2:1). It is now `#43796C` (about 5:1).
- **Copy:** pricing now says "In the planned model" so the payment structure reads as proposed. The pre-launch list in the trust section uses a customer-facing heading ("Answered in plain language before launch") instead of internal process wording. Small wording fix in the hackathon use case.
- **Claims check:** attendee flow includes sign-in (attendee steps, comparison, FAQ). No testimonials, logos, speed or accuracy figures, model names, unlimited plans, prices, or checkout. Sports is labeled "Exploratory pilot" with no bib search. The founder story is labeled as Ivan's own account.

## Known limitations

- I did not run this in a browser or execute the JavaScript myself. Behavior notes above come from reading the source; browser and JS checks are handled separately by the root review.
- `:has()` is used only to style the selected pill in the radio toggles. Older browsers fall back to the native radio dot.
- The FLIP animation scales tiles non-uniformly mid-move, so the SVGs stretch briefly. With reduced motion the change is instant.
- Without JavaScript the illustrations are empty tinted blocks. The text, anchors, and FAQ still work.
- Manrope loads from Google Fonts. Offline, the page falls back to Avenir Next, Segoe UI, or the system sans.
