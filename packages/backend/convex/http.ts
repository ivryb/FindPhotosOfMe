import { httpRouter } from "convex/server";

import { authComponent, createAuth, trustedOrigins } from "./auth";
import { webhook as creemWebhook } from "./payments";

const http = httpRouter();

authComponent.registerRoutesLazy(http, createAuth, {
  cors: true,
  // Convex's CORS helper uses *.domain for HTTPS-only subdomain matching.
  trustedOrigins: trustedOrigins.map((origin) => origin.replace(/^https:\/\/\*\./, "*.")),
});

http.route({
  path: "/api/creem/webhook",
  method: "POST",
  handler: creemWebhook,
});

export default http;
