import { httpRouter } from "convex/server";

import { authComponent, createAuth, trustedOrigins } from "./auth";
import { webhook as lemonsqueezyWebhook } from "./payments";

const http = httpRouter();

authComponent.registerRoutesLazy(http, createAuth, {
  cors: true,
  // Convex's CORS helper uses *.domain for HTTPS-only subdomain matching.
  trustedOrigins: trustedOrigins.map((origin) => origin.replace(/^https:\/\/\*\./, "*.")),
});

http.route({
  path: "/api/lemonsqueezy/webhook",
  method: "POST",
  handler: lemonsqueezyWebhook,
});

export default http;
