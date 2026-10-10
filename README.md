# FindPhotosOfMe

Face search for event photos. An organizer uploads an event's photos into a gallery; a guest sends a selfie, on the
gallery page or through the gallery's Telegram bot, and gets back the photos they appear in. Galleries can also let
guests add their own photos.

## How it fits together

- **`apps/web`**: Nuxt 4 app on a Cloudflare Worker. It serves the landing pages, the organizer dashboard, gallery
  pages, photos under `/media`, and each gallery's Telegram webhook (grammY).
- **`packages/backend/convex`**: Convex holds galleries, uploads, searches, balances and auth (Better Auth), and runs
  Telegram searches in its scheduler.
- **`python`**: FastAPI on Modal. InsightFace finds faces in uploaded photos, builds each gallery's face index, and
  matches selfies against it.
- **Cloudflare R2** stores photos, their thumbnail and screen versions, and face indexes.

Uploads go straight from the browser to R2 in batches. Convex hands each batch to Modal, which saves faces and resized
versions, screens every photo with OpenAI moderation, and merges the batch into the gallery's face index. A search
sends the selfie to Modal, which writes the matching photos back to Convex; the page updates live, and the Telegram bot
sends them to the chat.

Organizers pay from a shared balance topped up through Creem; see
[Product and pricing](docs/portfolio-launch.md#product-and-pricing).

## Development

```bash
bun install
bun run dev:web       # Nuxt on http://localhost:3001
bun run check-types   # all workspaces
bun run test          # web (bun test), backend (vitest), and Python (pytest through uv)
```

`bun run dev` and `bun run dev:server` also start `convex dev`, which pushes every saved backend file to the development
Convex deployment. Production is a separate deployment that only `bun run deploy` updates.

Each workspace lists its settings in an `.env.example`: `apps/web`, `packages/backend`, and `python`. To run the Python
service locally, see [python/README.md](python/README.md).

## Deployment

`bun run deploy` publishes Convex, then Modal, then the Worker. [DEPLOYMENT.md](DEPLOYMENT.md) covers what runs where,
secrets, and how to read production logs and data.
