# Spotlight: design rationale

A concept for the FindPhotosOfMe landing page that looks like conference signage. It follows `docs/landing-page-brief.md` and the frontend-design skill. It's a static local preview: `index.html`, `styles.css`, `scenes.js`, and `app.js`.

## Authorship

Claude (via Claude Code) designed and built this for Ivan over two sessions. The first session produced `index.html`, `styles.css`, `scenes.js`, and `app.js`, then hit a usage limit before writing this file. The second session reviewed the source, made the refinements listed below, and wrote this rationale. Neither session had a browser. Root orchestration ran the browser review separately: at 375px and 1440px there was no horizontal overflow, the demo returned the expected matches, the dialog closed on Escape, and the FAQ opened and closed. Those checks were run before the second session's edits, so they should be repeated.

## Token plan

**Colour** (the brief's palette, used as specified)

| Token | Hex | Role |
| --- | --- | --- |
| White | `#FFFFFF` | Main surface |
| Cobalt | `#2449D8` | Actions, the How it works panel and final panel, match outlines |
| Midnight | `#152358` | Text, heavy signage rules, founder panel, footer, phone frame |
| Pale blue | `#E9EEFF` | Alternating section bands, sample-photo backgrounds |
| Lemon | `#FFE08B` | Wayfinding tags ("Likely match", "Sample event", the demo label), photographer band, lemon button on cobalt |
| Slate | `#485778` | Secondary text |

Two supporting tints: `#CCD5F3` for hairline rules and `#1A38B3` for cobalt hover. White on cobalt and white on midnight are used only for type at heading or body size.

**Type**: Barlow Condensed 600–700 for display, headings, step numbers, and session times. DM Sans 400/500/700 for reading text and controls. Everything is sentence case. There are no all-caps labels and no monospace.

**Scale**: hero `clamp(3rem, 8.4vw, 7rem)` / .94, which is 48px on mobile and 112px on desktop. Section headings run 40–56px. Pricing and final headlines are larger poster lines, up to 88px and 96px. Body text is 18px / 1.6, and supporting text is never below 14px. Line lengths are capped at roughly 40–62ch.

**Layout**: a 1280px wrap with fluid gutters. Sections are full-width horizontal bands that alternate white, pale blue, and solid cobalt or midnight. Content is left-aligned throughout. Heavy 4px midnight rules mark the top of each information block, the way a printed programme or venue sign does.

```
[ preview bar                                               ]
[ brand        How it works  Who it's for  Pricing  Q's  CTA ]
THE WHOLE EVENT.
JUST YOUR MOMENTS.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
organizer lede + audience                  [Explore] [How it works]
[ stage ][ between ][ group ][ workshop ][ coffee ]  ← broad strip
---------------------------------------------------------------
problem copy            | 42-photo contact sheet → 4 focused
---------------------------------------------------------------
[phone: selfie, sign-in state] | conference programme (6 sessions)
                               | narrows to one person's photos
===== cobalt: organizer route 1-2-3 / attendee route 1-2-3-4 =====
dashboard illustration | organizer value
uses: conference lead card | meetups / hackathons / sports pilot
comparison table
===== midnight: founder timeline + Ivan's account =====
POSTER PRICING LINE / three-part model board / status + preview CTA
expectations / FAQ / ===== cobalt final invitation ===== / footer
```

## Principles and review against the skill

- **One bold idea.** The demo turns a conference programme into one person's photos. The sample event is laid out as a timed programme: 09:00 Registration through to 17:30 Closing and group photo. When a sample selfie is searched, the frames that don't match fade back and the likely matches get a lemon "Likely match" tag, the same way a highlighted line on a schedule stands out. The phone shows the same set of photos at real phone size. Motion is limited to two places: the hero strip arrives frame by frame once on load, and the results animate in after the visitor starts a search. Both are turned off when reduced motion is requested.
- **Headline.** The second session switched to the brief's energetic option, "The whole event. Just your moments." It names exactly the change the demo shows ("Whole event: 18 sample photos" becomes "Olena's likely matches: 5 of 18"). It also keeps Spotlight apart from Gather, which leads with the recommended headline. The organizer offer stays in the sentence directly beneath it, and the next line names the audience.
- **Numbering only for real sequences.** Numbered stops appear only in the organizer and attendee routes. Use cases, pricing, and expectations are unnumbered.
- **Avoided defaults.** It doesn't use the cream/terracotta or black/neon looks. Sections aren't a grid of identical rounded cards. There are no all-caps eyebrows, middle-dot meta strings, or arrows appended to buttons. Corner radius depends on what the element is: about 4–6px on panels and signage tags, a large radius on the phone, and a full pill only on the "Pilot idea" tag.
- **Accessory removed.** The second session cut the hero from three stacked lines in a narrow column to two full-width lines. This removed awkward wrapping at desktop size and let the headline read as a sign.

## Section narrative (12)

1. Hero, followed by a broad illustrated strip of five event scenes
2. The familiar problem: a dense contact sheet next to a focused set
3. Illustrative demo: a sample selfie picker, an attendee who is signed in, a programme that narrows to that person, and results
4. How it works, on a cobalt panel: the organizer route has 3 steps and the attendee route has 4 (open link, sign in, selfie, review and download)
5. Organizer value, beside a small illustrated dashboard (Uploaded, Preparing photos, Ready to share, and a share link)
6. Who it's for: conferences lead, then meetups, hackathons, and sports, which is labelled "Pilot idea, not yet tested" and notes that there's no bib search. A lemon band follows for photographers.
7. Alternatives: ZIP archive, shared album, and FindPhotosOfMe. On mobile the table becomes labelled rows.
8. Founder origin on a midnight panel, credited to Ivan as his own account and explicitly not an event endorsement
9. Pricing model: pay once per event, attendees search free, no subscription. "Launch pricing is being finalized" and nothing is on sale. No prices or tiers are shown, and nothing is marked "Most popular".
10. Expectations: what helps, what affects results, a note that a match isn't proof of identity, and a privacy box that says the plain-language policy answers are still to come
11. FAQ: 8 native `details` items, with the two answers that depend on launch decisions marked "Preview note"
12. Final cobalt invitation and footer, which has in-page navigation and a one-line preview note

## Claim and honesty checks (source review)

- The attendee flow includes sign-in in the demo, the attendee route, the comparison table, the pricing board, and the FAQ.
- The copy never says instant, every photo, a percentage, a speed figure, unlimited use, subscriptions, or no account. The demo's delay is staged and labelled as such.
- "Create an event" (in pricing and the final panel) opens a native `<dialog>` that says nothing is created or charged. Its "Explore the demo" button closes the dialog and moves focus to the demo heading. There's no checkout, form, or fake success message.
- There are no testimonials, logos, ratings, or invented contact details. The footer doesn't link to policies that don't exist yet.
- Telegram appears only as the origin story and as a channel whose availability needs confirming.

## Source refinements in this session

- Hero: the headline is now "The whole event. Just your moments." on two full-width lines, with the offer and calls to action on a ruled band beneath it. This adds `.hero-copy` grid rules and a single-column fallback at 900px or below.
- Added a global `[hidden] { display: none !important; }` guard. Audit result: the only element hidden by demo state is `.results`, and no rule sets `display` on it. The guard keeps future layout rules from revealing it. The mobile rule `.strip-frames li:nth-child(n + 4) { display: none }` is intentional and doesn't involve `hidden`.
- Customer-facing tone: the How it works note now gives practical guidance (photos are prepared after upload, and the link should be shared once the event is ready) instead of internal release status. The "Required before launch" box became "Privacy, in plain language" and keeps the same honest scope.
- Anchors checked: `#main`, `#top`, `#demo`, `#how`, `#who`, `#pricing`, and `#questions` all exist. Local files referenced: `styles.css`, `scenes.js`, `app.js`, all present.

## Asset notes

- **There are no photographs and no stock images.** Every image is an inline SVG drawn by `scenes.js` for a fictional "Northline Product Conference". Olena and Marko are fixed illustrated characters, so the selfie and the results show the same person. Other people are generated from a seed, and their colours never copy Olena's lemon top or Marko's green sweater.
- Images are labelled as illustrative wherever they appear. The hero strip caption, the contact-sheet caption ("Demo data: 42 illustrated sample photos…"), the demo flag, the "Sample event" and "Sample selfie" tags, the dashboard caption, and the `aria-label`s that begin "Sample photo:" all say so. Decorative repeats are `aria-hidden`.
- The brand mark is an inline placeholder SVG, not a final logo.
- **Network dependency:** Barlow Condensed and DM Sans load from Google Fonts. If they're offline, the stacks fall back to Arial Narrow or Roboto Condensed and to system sans-serif. The layout survives, but the signage character is weaker.
- Before launch, the illustrations should be replaced with permissioned real event photography. No IT Arena imagery or logos are used.

## Limitations

- Not run in a browser in this session. The changes since root's review need to be checked again, especially the hero wrapping at 375px, 768–900px, and 1440px. Font metrics are estimated, and "Just your moments." is expected to wrap to two lines at 375px.
- The demo has no real search, upload, or download. "Download photos" only updates the status text.
- The header CTA is hidden at 760px or below, and the header stops being sticky there. The section navigation scrolls horizontally if it doesn't fit.
- `:has()` is used only to highlight the selected selfie choice. The radio button still shows the selection where `:has()` isn't supported.
- The privacy and retention answers, final prices, contact details, and legal pages are intentionally missing until they're real.
