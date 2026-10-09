# FindPhotosOfMe

Face search for event photos: a guest sends a selfie, on the web or through a gallery's Telegram bot, and gets the photos they appear in.

- `apps/web`: Nuxt app on a Cloudflare Worker, covering the landing pages, dashboard, galleries, photo serving, and Telegram webhooks.
- `packages/backend/convex`: Convex for auth, data, upload coordination, and Telegram searches.
- `python`: FastAPI face processing and search on Modal, using InsightFace.
- Photos and face indexes are stored in Cloudflare R2.

## Working rules

- Keep the existing Convex deployment and R2 storage unless Ivan requests a migration.
- Push, deploy, or change production only when Ivan explicitly requests it. `bun run dev` and `bun run dev:server` run `convex dev` against the live Convex deployment, so every saved backend file reaches users; check Convex changes with tests and type checks instead.
- `bun run check-types` and `bun run test` (which includes the Python tests) are the checks CI runs.
- Before declaring the product ready to launch, verify sign-in, event creation, photo upload and processing, face search, downloads, and checkout entitlements. Use a test event and separate accounts to verify ownership and access to private search results.

## Task references

- For deployment, production logs or data, DNS, Telegram execution, or service credentials, read [DEPLOYMENT.md](DEPLOYMENT.md).
- For Convex functions, schema, or queries, read [the Convex guidelines](docs/convex_rules.md).
- For Python processing or local inference, read [python/README.md](python/README.md).
- For landing-page design or public claims, read the [creative brief](docs/landing-page-brief.md).
- For pricing or billing changes, read [Product and pricing](docs/portfolio-launch.md#product-and-pricing) for the per-event model, free attendee search, and dedicated Lemon Squeezy store.
