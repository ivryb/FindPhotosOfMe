# Gallery publication

New galleries need only a name. They start private, with no page address, and owners can add photos in Upload photos and search them in a separate Search section. Owner searches and their result downloads require the owner's identity, even after publication.

The Gallery page tab begins with “Publish this gallery.” Save a unique page address before switching publication on. Only published galleries show a share link and QR code. Unpublishing closes public gallery browsing, new attendee searches (including Telegram), and existing attendee photo URLs on their next request. Photos already displayed or downloaded cannot be recalled.

Photos and thumbnails use stable `/media/{galleryId}/{filename}` URLs. The Worker checks the current access policy through `collections.canReadPhoto` before serving R2 or edge-cached bytes. Public galleries expose all their photos unless they are configured to expose only selected previews. Owners can view their own galleries through their session cookies. Search-result links include `requestId`; that request must still be accessible and the photo must be one of its matches. Image URLs have no signing key or expiry.

The edge cache keeps the image bytes for two days, independently of access. Browsers use private caching with revalidation, so each request checks access even when it receives a 304 response instead of downloading the image again. View, download, and search URLs reuse the same edge-cached bytes; attachment headers are added after the access check.

Existing galleries with no `published` value retain their public access. Creation explicitly records `published: false`; no migration is needed. Dashboard routes accept the gallery ID so a private gallery needs no address; old dashboard links using addresses still work.

On mobile, `/admin` shows a vertical gallery list. Opening a gallery shows only that gallery, with an “All galleries” back link. A vertical section menu replaces tabs, with smaller headings and one horizontal content gutter. There is no horizontal scrolling. Desktop retains the sidebar and detail layout.

Deletion is in the separate Settings tab. Publication does not change billing or storage expiry.

Regression coverage: `packages/backend/tests/publication.test.ts` exercises ownership, publication, legacy access, and media/result authorization through Convex. `packages/backend/tests/auth.test.ts` verifies that per-photo session checks can exceed the ordinary authentication rate limit while other endpoints retain their limit. Web HTTP tests verify stable URLs, identity forwarding, selected previews, conditional responses, and access after unpublishing. Local browser checks use `bun tests/serve.ts` from `apps/web`, with isolated fixtures.
