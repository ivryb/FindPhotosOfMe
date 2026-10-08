# Crowdsourcing flow review

Captured on 6 October 2026. The live screenshots below use a temporary production test event; the original review captures use isolated backend and storage fixtures. No Telegram messages were sent.

## Live release checks

The deployed guest gallery kept a portrait and a photo without faces, skipped a corrupt JPEG, and updated from empty to two photos while the page remained open. Both compact actions open their sheets, and the viewer offers original downloads.

- [Live mobile gallery and both actions](live-actions-mobile.png)
- [Live upload sheet](live-upload-sheet-mobile.png)

The screenshots use a 390 × 844 viewport. The deployed gallery also fits 320 pixels, including its long test-event title. Real browser PUTs succeeded from both the canonical site and the optional gallery subdomain.

[Live verification results](live-verification.json) cover real processing, search, downloads, access controls, credit settlement after expiry, and cleanup. The temporary gallery and its storage were removed after verification.

## Current guest controls

The guest gallery now has two compact floating pills together at the bottom: **Upload your photos** and **Find me**. Each opens its own sheet. Closing a sheet keeps uploads and search state available; only one sheet is open at a time.

![Compact desktop actions](guest-actions-desktop.png)

![Upload sheet listing uploads that are uploaded, stopped, refused, and processed](guest-upload-sheet-desktop.png)

![Find me opens the existing selfie explanation](guest-find-me-desktop.png)

Mobile views at 390 × 844: [gallery actions](guest-actions-mobile.png), [upload sheet](guest-upload-sheet-mobile.png), [selfie sheet](guest-find-me-mobile.png), [search in progress](guest-searching-mobile.png). Both pills also fit a 320-pixel-wide viewport without clipping.

On 8 October 2026 the guest sheet stopped treating processing as part of the upload. The pill spins only while files are going to storage. As soon as the last batch is confirmed, the row reads **Uploaded** with a note that processing can take a while, although the fixture still reports no processed photos.

Later the same day both sheets were reworked after reviewing a first recording of every state. Once a guest has chosen photos, their uploads lead the sheet, newest first, and the large drop zone becomes an **Add more photos** button; files can be dropped anywhere on the sheet. Each upload's status icon stands beside both of its lines, and the upload being sent shows a progress bar. While a search runs, the selfie sheet shows only the selfie, its title, and the progress bar, with no separate **Keep browsing** link, and on phones it fits that content instead of covering most of the screen. The current captures above and the recordings below show these layouts.

Verified 55 selected photos reached the fixture storage in batches of 50 and 5. Upload status survived closing, opening the search sheet, and reopening uploads. Close buttons and Escape return focus to the triggering pill; backdrop dismissal works. Disabling contributions while its sheet is open restores the remaining **Find me** action. These captures use the same pending-processing fixture described below.

The final browser pass repeated the 55-photo upload while signed out through the updated batch reservation and completion endpoints. All 55 unique objects reached storage, both batches were confirmed after the server checked stored sizes, and the page showed processing with no upload errors. [Recorded verification values](upload-verification.json). The collaborative browser disconnected after opening the search sheet during this final pass, so the 6 October screenshots remained the visual evidence until the 8 October recapture, and the earlier pass covers reopening behavior.

## Sheet state recordings

Recorded on 8 October 2026 at 390 × 844 against the fixture app, after the sheet rework described above. Captions name each step and white circles mark taps. Files were assigned to the real file inputs, the fixture controls set search outcomes and finished processing, and the dropped connection was simulated by failing the browser's storage uploads.

- [Upload flow, 70 seconds](guest-upload-flow.mp4): the empty sheet; a file with no photos, a damaged ZIP, and photos over 50 MB, each added after the first with **Add more photos**; a ZIP and 55 photos opening and uploading one at a time while the second waits; closing and reopening the sheet mid-upload; both marked uploaded; processing that adds all, some, or none of an upload's photos; a dropped connection; and, after the page is reopened, the same 60 photos resuming from photo 51 in the stopped upload's place. The video joins two recordings where the page reloads.
- [Find me flow, 59 seconds](guest-find-me-flow.mp4): the sheet before a selfie; the compact searching sheet, then browsing while the button spins; three photos found and one opened in the viewer; an unsupported file type and a photo over 10 MB; no face, no matching photos, a failed search, and paused searching.

The recordings omit the **Uploads are unavailable** alert, which appears only when the upload list fails to load, because the fixture cannot fail that subscription.

## Earlier recordings

The earlier guest recording and screenshots below show the previous upload panel and search banner. They remain here as the original review evidence; the screenshots above show the current interface. The admin controls are unchanged.

- [Admin setup, 8 seconds](admin-flow.mp4): choose secret-link sharing, enable guest contributions, save, and show the resulting share link.
- [Guest flow, 18 seconds](guest-flow.mp4): expand the uploader, submit 55 photos, see processing status, and browse existing photos in the viewer.

## Admin

![Secret-link sharing and guest uploads enabled](admin-settings.png)

![Saved gallery link and QR code](admin-sharing.png)

## Guest

![Shared gallery](guest-gallery.png)

![Upload instructions](guest-upload.png)

![55 photos submitted and processing](guest-processing.png)

![Photo viewer with navigation and download controls](guest-viewer.png)

![Empty gallery before its first contribution](guest-empty.png)

## Mobile

Captured at a 390 × 844 CSS-pixel viewport.

![Mobile gallery](mobile-gallery.png)

![Mobile upload and processing status](mobile-processing.png)

## Scope of the local preview

The admin and guest pages use independent sample galleries. The admin fixture contains 2,742 photos; the guest fixture contains 130. They are not a recording of one event moving between accounts.

The guest was signed out before recording. The 55 JPEG files were assigned to the real file input by browser automation; the native operating-system file picker is not recorded. The browser uploaded 55 distinct storage objects in two batches of 50 and 5. The fixture intentionally leaves processing pending, so the viewer shows existing sample photos rather than completed contributions. No real balance was charged.

The Telegram chat is not captured: this isolated preview has no connected test bot. Its implemented choices are **Find my photos**, **Upload photos**, and **Browse gallery → Open gallery**. A live Telegram capture remains separate from this local web review.

To reproduce the local preview, run `bunx nuxt prepare` followed by `bun tests/serve.ts` from `apps/web`. Open `http://localhost:3215/gallery/0123456789abcdef0123456789abcdef`. For admin access, the fixture accepts `owner@example.com` and code `123456` at `/sign-in`; no email is sent. Open `/admin/galleries/test-collection?tab=page`. Do not run the HTTP tests concurrently with this fixture server.

To walk through search and processing states, POST to the fixture controls printed by the server. `/__fixture/search` with `{"outcome":"none","delayMs":2000}` sets how later searches end (`found`, `none`, `no_face`, `failed`, or `paused`) and how long they take. `/__fixture/process` with `{"failed":2}` finishes the oldest upload still waiting for processing and leaves out that many of its photos.
