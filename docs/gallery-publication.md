# Gallery publication and guest uploads

New galleries need only a name and start private. Publishing makes the gallery available at an unguessable `/gallery/{token}` link. Empty galleries can be published, so guests can contribute the first photos. The Gallery page settings offer an optional public subdomain instead. Existing galleries keep their subdomain access until their owner changes that setting; switching to a secret link closes the old address rather than redirecting it to the secret.

Owners can enable **Let guests upload photos** in Gallery page settings. Anyone with access can then upload multiple JPEG/PNG photos or ZIPs without an account, on the gallery page or through its Telegram bot. All valid photos submitted while crowdsourcing is enabled are kept, including photos without faces. Face search indexes only detected faces. The gallery shows all photos without owner approval after processing. Turning contributions off prevents new batches; already accepted batches finish under the policy they were submitted with, and browsing stays enabled unless the owner changes it separately.

The gallery has two compact floating actions at the bottom: **Upload your photos** and **Find me**. Each opens its own sheet. Upload and search progress survive closing the sheet so guests can keep browsing. Empty crowdsourced galleries show the upload action; galleries with contributions disabled show only search.

Guest uploads use the existing owner balance and processing queue. Starting an upload checks that the available balance can cover it. Each batch then reserves credit before receiving storage URLs for its exact filenames and byte sizes. The URLs last 15 minutes; retries reuse the same reservation and deadline. Completing an upload checks the stored files on the server, then atomically converts the reservation into a charge and queues processing. Guests cannot confirm an upload directly in Convex. The dashboard shows **Available balance**, excluding pending reservations.

Abandoned batches release their reservation only after their URLs expire, a one-minute clock margin passes, and their storage objects are deleted. The existing two-minute recovery job performs cleanup and retries storage failures. Unreadable photos and failed processing are refunded through the same cleanup after URL expiry, so still-valid upload URLs cannot be reused after credit is returned. Each batch has a separate storage prefix; a cleanup retry cannot delete a later attempt's files. Owner deletion retains its existing behavior of settling outstanding credit after removing the gallery's storage.

There is no additional guest quota or content moderation. Browser uploads retain the existing JPEG/PNG, 50 MiB per-photo limit and ZIP support. Basic file and access checks remain in place.

Each guest browser stores a random contributor key locally. Upload creation, resumption, progress, and presigned storage URLs are scoped to that contributor and gallery. Clearing browser storage loses the ability to resume those uploads. Other visitors cannot list or overwrite them. Owners retain access to all gallery uploads.

## Access and media

For link-only galleries, the token is checked on gallery metadata, photo listing, media, selfie-search creation, and guest-upload operations. Knowing a collection ID or its former subdomain is insufficient. Link pages send `noindex, nofollow, noarchive`, use `Referrer-Policy: no-referrer`, and are excluded in robots.txt. Media also carries a noindex header. These directives apply to compliant crawlers; the access credential remains the actual authorization mechanism.

Photos and thumbnails use `/media/{galleryId}/{filename}` URLs. Link-only browsing includes the gallery token; search-result URLs include their independently scoped `requestId`. The Worker checks access through `collections.canReadPhoto` before serving R2 or edge-cached bytes. Owner searches and their result downloads always require the owner's identity. Attendee result links authorize only matched photos.

Unpublishing closes browsing, new attendee searches (including Telegram), uploads, and existing attendee photo URLs on their next request. Owners can still manage their galleries. Photos already displayed, downloaded, or delivered to Telegram cannot be recalled. Expiry and refunds also close guest access.

The edge cache keeps bytes for two days independently of access. Browsers use private caching with revalidation, so each request checks access even for a 304. Gallery tokens and request IDs are removed from the edge cache key after authorization; view and download URLs reuse the same cached bytes.

## Telegram

The bot provides **Find my photos**, **Upload photos** (when enabled), and **Browse gallery**, which returns an Open gallery link. Search selfies are never gallery contributions. Upload mode persists until the user chooses Find my photos or restarts with `/start`. Photos, albums, and JPEG/PNG documents in upload mode enter the existing R2 and Convex ingestion pipeline. Albums receive one acknowledgement rather than one for every photo. Sending photos as documents preserves the original quality; Telegram's hosted Bot API can download files up to 20 MB, and larger files are directed to the web uploader.

Link-only galleries require a Telegram invite with `?start={token}` before the bot reveals gallery content or accepts photos. Authorization and mode are stored per private chat and checked against the current gallery settings. Public-subdomain bots keep their discoverable access. Group chats are directed to private chat so one person's upload mode cannot publish somebody else's selfie.

Connecting a bot records its username to produce the invite link in the dashboard. For existing bots without a recorded username, Save changes refreshes the connection and displays the invite. Existing custom welcome messages retain MarkdownV2 formatting and `{IMAGES_COUNT}` substitution.

## Release and verification

This change is local and has not been deployed. The original checkout has an active `convex dev` watcher targeting the shared live deployment, so implementation is isolated in the `feat/crowdsource-uploads` worktree. Do not copy changes into that watched checkout as an implicit deployment.

Release the Python processor before enabling the new Convex/web behavior, then deploy Convex and the web app together. No migration of existing galleries or storage is required; optional schema fields preserve legacy access and queued batches retain their existing storage paths. The cleanup action uses the existing Convex R2 credentials; no new queue or service is required. Verify R2 CORS allows the canonical site and opted-in gallery subdomains: guest uploads can now originate on a subdomain, whereas owner uploads originate on the main dashboard. Verify a real signed PUT with its required content type and content length. No R2 configuration was changed in this task.

Latest local result: 66 backend tests, 41 web tests, and 21 Python tests passed. Both type checks and the production build passed. The existing Vue/Volar plugin-resolution warning remains non-fatal. Implementation review found no outstanding issues.

Local regression coverage:

- `bun run --filter @FindPhotosOfMe/backend test`: ownership, secret-link enforcement, empty galleries, contributor isolation, reserved credit, retry/expiry behavior, deferred refunds, upload closure, legacy access, Telegram invites and mode separation. Telegram action tests use real Convex functions with fake external Telegram/R2 transports, checking staged bytes, queued work, charges, album acknowledgements, and cleanup failures/retries.
- `cd apps/web && bun test tests`: actual Nuxt HTTP routes against isolated backend/storage fixtures, covering media, authentication, secret-link propagation, search, crawler headers, empty galleries, signed upload sizes/deadlines, and server-confirmed completion. Source tests check the exact bytes declared for both ZIP and loose photos. Run these separately from `bun tests/serve.ts`; Nuxt allows only one dev server per fixture root.
- `python/tests/test_processing.py`: keeps scenery in crowdsourced batches, indexes only faces, and prevents a corrupt guest photo from discarding the valid photos in its batch. Ordinary galleries retain face-only behavior.
- `bun run check-types` and `bun run --filter web build`: both backend/frontend typing and the production Worker bundle.

Browser verification on 6 October 2026 used the isolated fixture app: an anonymous selection of 55 photos produced 55 distinct storage objects in batches of 50 and 5, and showed processing progress. The empty gallery showed its first-contribution prompt. At 390 px viewport width there was no horizontal overflow in the gallery uploader or owner settings. Saving secret-link sharing and guest uploads changed the share URL and removed the subdomain input. Screenshots and recordings were captured in a subsequent review session; see the [visual review](review/crowdsource/README.md) for the artifacts and fixture limitations.

Live Telegram delivery, real R2 CORS on gallery subdomains, and deployment against the hosted services remain release checks. The local tests do not claim those have been exercised.
