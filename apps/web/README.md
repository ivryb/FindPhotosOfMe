# Web app

The Nuxt app behind findphotosofme.com, running on a Cloudflare Worker. The repository [README](../README.md) shows how
it fits with Convex and the Python service.

## Sign-in

The browser uses Better Auth through the same-origin `/api/auth/**` proxy. Sessions live in HttpOnly cookies; the server uses the session cookie to obtain a Convex JWT for each admin request. No JWT or session token is included in the Nuxt page payload.

Google still calls the existing Convex OAuth callback. Its one-time token returns through `/auth/callback`, which checks the initiating browser, exchanges the token, sets the app's cookies, and redirects to the requested local page. Localhost and production keep separate cookies and use the same Convex deployment.

Admin pages use `useFetch` for their initial owner-authorized data and `useLiveQuery` for subsequent updates. The live subscription starts once Convex confirms authentication and preserves the initial data while connecting. Admin and auth responses use `private, no-store`. Organizer upload endpoints still require bearer tokens from `getConvexAuthToken()`. Attendee selfie upload, search progress, and result downloads are public. New searches can be read by their request ID; existing private and Telegram searches retain their access checks. Download URLs are only issued for photos in that completed search.

## Testing against the fixture backend

`bun test` starts Nuxt against `tests/backend.ts`, an isolated HTTP/WebSocket stand-in for Convex, R2, and the search
service, so tests never touch the live deployment. `bun test tests/auth.test.ts`, for example, checks auth cookies,
callback redirects, unauthorized requests, and the initial HTML of the admin pages.

For browser verification, run `bun tests/backend.ts`, then `TEST_BACKEND_URL=http://localhost:3211 bun x nuxt dev tests --port 3212 --dotenv /dev/null`. The fixture accepts any email code. Open the admin pages and POST a new title as plain text to `http://localhost:3211/__fixture/title` to check live updates without reloading. Verify logout and that `document.cookie` cannot read the session. Production Google and email delivery remain separate end-to-end checks.
