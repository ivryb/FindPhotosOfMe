# FindPhotosOfMe

Ivan values simplicity: keep code lean and reliable, preserve the user experience, and communicate clearly and honestly.

## Portfolio launch goals

- Package the project as a polished, production-safe portfolio product.
- Build a clean landing page inspired by HeadshotPro's clarity and brand voice, aimed at conference organizers, meetup and community organizers, photographers, and event attendees. Iterate on this in its dedicated Codex task.
- Define simple pricing that accounts for real infrastructure and face-recognition costs.
- Use the dedicated FindPhotosOfMe Lemon Squeezy store for one-time, per-event checkout and verified webhook entitlements; never mix its products or webhooks into another project's store. Keep free attendee search and avoid subscriptions until real demand requires them.
- Host Nuxt (website, dashboard, API and Telegram webhook) on Cloudflare Workers. Keep the existing Convex deployment and R2 storage; Telegram search continuations use the Convex scheduler. Prefer free tiers where practical.
- Host Python face recognition on Modal. Keep old Google Cloud resources until their separately approved cleanup; see `docs/modal-handoff.md` when changing Python hosting.
- Add Better Auth with email one-time-password sign-in and Google sign-in, following the proven Listenly flow where it fits this codebase.
- Make the public-internet launch safe: fix security issues, establish ownership and authorization boundaries, and add any missing user, organization, event, collection, upload, search, or billing data models required by the real flows.
- Validate the complete new-user journey before launch: sign in, create or manage an event collection, upload/process photos, find matching photos, and enforce access boundaries.

## Working rules

- Prefer the smallest durable change that solves the real user problem.
- Ground infrastructure, pricing, and security decisions in current code and live read-only evidence.
- Do not push, deploy, or mutate production unless Ivan explicitly asks.
