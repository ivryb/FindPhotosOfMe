# Gallery refresh regression checks

Verified against the running local Nuxt app on 6 October 2026. The tests use its real gallery page, reactive Convex subscription, photo-listing endpoint, and gallery viewer. Only Convex and R2 are fixtures. No production services are involved.

From `apps/web`, run `bunx nuxt prepare`, then `bun tests/serve.ts`. Open `http://localhost:3215/search?subdomain=itarena`. The server prints the fixture control URL; POST JSON to that URL to perform the steps below. Do not run the HTTP test suite concurrently with this server.

## Retry after a failed automatic refresh

1. Wait until the gallery's photos load.
2. POST `{"imagesCount":130,"listingError":true}`. On a fresh fixture, this changes the count from 2,742 and triggers an automatic refresh while R2 listings return HTTP 503.
3. Wait for “Couldn’t load the photos. Try again”.
4. POST `{"listingError":false}` without changing the count, then click **Try again**.

Before the fix, the error remained and the gallery did not recover. After the fix, the error disappeared and photo tiles returned without a page reload. The existing photos remain available to the composable during a failed refresh; its normal retry now fetches again.

## Enable contributions on an already open preview gallery

1. POST `{"imagesCount":130,"showAllPhotos":false,"crowdsource":false,"listingError":false}`.
2. Reload the page and wait for its one preview photo to load.
3. POST `{"crowdsource":true}`. This also enables full browsing, leaving the photo count unchanged.
4. Wait for **Upload your photos**, then open photo 3.

Before the fix, the contribution control appeared and the preview notice disappeared, but the grid still contained only the one preview. After the fix, the existing page loaded the full listing. The viewer opened photo 3 and displayed **3 of 130**.

Web typechecking passed after both changes, with the existing non-fatal Vue Router/Volar plugin warning.
