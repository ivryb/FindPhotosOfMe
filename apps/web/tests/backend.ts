import type { ServerWebSocket } from "bun";
import type { ClientMessage } from "../node_modules/convex/src/browser/sync/protocol";

type SocketData = {
  version: { querySet: number; identity: number; ts: string };
  queries: Map<number, string>;
};

export const sessionCookie = "__Secure-better-auth.session_token=test-session";
export const ownerJwt = `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify({ sub: "owner", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`;

export function startBackend(port = 0) {
  let title = "IT Arena SSR fixture";
  let timestamp = 0;
  const sockets = new Set<ServerWebSocket<SocketData>>();
  const collection = () => ({
    _id: "test-collection", _creationTime: 1700000000000, subdomain: "itarena",
    title, description: "Owner-only description", imagesCount: 2742,
    status: "complete", previewImages: [], createdBy: "owner",
  });
  const result = (path: string) => path === "ingestJobs:listByCollection" ? []
    : path === "collections:getAll" ? [collection()] : collection();
  function transition(socket: ServerWebSocket<SocketData>, querySet = socket.data.version.querySet, identity = socket.data.version.identity) {
    const startVersion = socket.data.version;
    const ts = Buffer.alloc(8);
    ts.writeBigUInt64LE(BigInt(++timestamp));
    const endVersion = { querySet, identity, ts: ts.toString("base64") };
    socket.send(JSON.stringify({ type: "Transition", startVersion, endVersion,
      modifications: [...socket.data.queries].map(([queryId, path]) => ({
        type: "QueryUpdated", queryId, value: result(path), logLines: [], journal: null,
      })),
    }));
    socket.data.version = endVersion;
  }
  return Bun.serve({
  port,
  async fetch(request, server) {
    if (request.headers.get("upgrade") === "websocket") {
      if (server.upgrade(request, { data: { version: { querySet: 0, identity: 0, ts: "AAAAAAAAAAA=" }, queries: new Map() } })) return;
    }
    if (new URL(request.url).pathname === "/__fixture/title") {
      title = await request.text();
      for (const socket of sockets) transition(socket);
      return new Response("Updated");
    }
    const path = new URL(request.url).pathname;
    if (path === "/api/auth/email-otp/send-verification-otp") return Response.json({ success: true });
    if (path === "/api/auth/sign-in/email-otp") {
      return Response.json({ token: "test-session" }, {
        headers: { "set-cookie": `${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    if (path === "/api/auth/sign-out") {
      return Response.json({ success: true }, { headers: {
        "set-cookie": "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      } });
    }
    if (path === "/api/auth/sign-in/social") {
      const body = await request.json();
      return Response.json({ url: body.callbackURL });
    }
    if (path === "/api/auth/cross-domain/one-time-token/verify") {
      const body = await request.json();
      if (body.token !== "valid-once") return new Response(null, { status: 401 });
      return Response.json({ session: { token: "test-session" } }, { headers: {
        "set-cookie": `${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      } });
    }
    const signedIn = request.headers.get("cookie")?.includes("test-session");
    if (path === "/api/auth/get-session") return Response.json(signedIn ? {
      session: { id: "session-1", userId: "owner", expiresAt: "2099-01-01T00:00:00Z" },
      user: { id: "owner", email: "owner@example.com", name: "Owner" },
    } : null);
    if (path === "/api/auth/convex/token") return Response.json(signedIn ? { token: ownerJwt } : {}, { status: signedIn ? 200 : 401 });
    if (path === "/api/mutation") {
      const body = await request.json();
      if (body.path === "searchRequests:create") return Response.json({ status: "success", value: "fixture-search", logLines: [] });
    }
    if (path === "/api/search-photos") {
      const form = await request.formData();
      if (request.headers.get("authorization") !== "Bearer fixture-service-token" || form.get("search_request_id") !== "fixture-search" || !form.get("reference_photo")) {
        return new Response("Invalid search", { status: 400 });
      }
      return Response.json({ success: true });
    }
    if (path === "/api/query") {
      const body = await request.json();
      if (body.path === "collections:getPublicBySubdomain") return Response.json({ status: "success", value: collection(), logLines: [] });
      if (body.path === "searchRequests:authorizeImages") return Response.json({ status: "success", value: body.args[0].id === "fixture-search" && body.args[0].keys.every((key: string) => key === "test-collection/match.jpg"), logLines: [] });
      if (request.headers.get("authorization") !== `Bearer ${ownerJwt}`) return new Response(null, { status: 401 });
      if (body.args?.[0]?.subdomain === "other-owner") return Response.json({ status: "error", errorMessage: "Not authorized", logLines: [] });
      if (body.args?.[0]?.subdomain === "missing") return Response.json({ status: "success", value: null, logLines: [] });
      return Response.json({ status: "success", value: result(body.path), logLines: [] });
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(socket: ServerWebSocket<SocketData>) { sockets.add(socket); },
    close(socket: ServerWebSocket<SocketData>) { sockets.delete(socket); },
    message(socket: ServerWebSocket<SocketData>, raw: string | Buffer) {
      const message: ClientMessage = JSON.parse(raw.toString());
      if (message.type === "Authenticate") transition(socket, undefined, message.baseVersion + 1);
      if (message.type === "ModifyQuerySet") {
        for (const modification of message.modifications) {
          if (modification.type === "Add") socket.data.queries.set(modification.queryId, modification.udfPath);
          else socket.data.queries.delete(modification.queryId);
        }
        transition(socket, message.newVersion);
      }
    },
  },
});
}

if (import.meta.main) startBackend(3211);

