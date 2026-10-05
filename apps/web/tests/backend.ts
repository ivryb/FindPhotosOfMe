import type { ServerWebSocket } from "bun";
import type { ClientMessage } from "../node_modules/convex/src/browser/sync/protocol";

type SocketData = {
  version: { querySet: number; identity: number; ts: string };
  queries: Map<number, string>;
};

export const sessionCookie = "__Secure-better-auth.session_token=test-session";
export const ownerJwt = `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify({ sub: "owner", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`;

// A fake R2 bucket: a public gallery of 130 photos with thumbnails and a face index, served from the landing samples.
const SAMPLES = ["nx-01", "nx-02", "nx-03", "nx-04", "t01", "t02", "t03", "t04", "u03", "u04"];
const GALLERY_PHOTOS = Array.from({ length: 130 }, (_, index) => `photo-${String(index + 1).padStart(3, "0")}.jpg`);
/** What the fixture search finds. */
const FOUND = ["test-collection/photo-007.jpg", "test-collection/photo-042.jpg", "test-collection/photo-099.jpg"];
const BUCKET_KEYS = [
  "test-collection/embeddings.json",
  ...GALLERY_PHOTOS.flatMap((name) => [`test-collection/${name}`, `test-collection/thumbs/${name}`]),
].sort();

/** Answers ListObjectsV2 the way R2 does, for the keys under one prefix and after `start-after`. */
function listBucket(url: URL) {
  const prefix = url.searchParams.get("prefix") ?? "";
  const after = url.searchParams.get("start-after") ?? "";
  const max = Number(url.searchParams.get("max-keys") ?? 1000);
  const delimiter = url.searchParams.get("delimiter");
  const matching = BUCKET_KEYS.filter((key) => key.startsWith(prefix) && key > after && !(delimiter && key.slice(prefix.length).includes(delimiter)));
  const page = matching.slice(0, max);
  const contents = page.map((key) => `<Contents><Key>${key}</Key><Size>1</Size></Contents>`).join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>fixture-bucket</Name><Prefix>${prefix}</Prefix><KeyCount>${page.length}</KeyCount><MaxKeys>${max}</MaxKeys><IsTruncated>${matching.length > max}</IsTruncated>${contents}</ListBucketResult>`,
    { headers: { "content-type": "application/xml" } },
  );
}

/** Public views of the fixture galleries: one browsable, one showing only previews, one whose owner is out of balance. */
function publicGallery(id: string) {
  const base = { _id: id, subdomain: "itarena", title: "IT Arena SSR fixture", description: "Photos from both days.", imagesCount: GALLERY_PHOTOS.length };
  if (id === "test-collection") return { ...base, previewImages: [], showAllPhotos: true };
  if (id === "preview-collection") return { ...base, previewImages: ["test-collection/photo-001.jpg", "test-collection/photo-002.jpg"], showAllPhotos: false };
  return null;
}

export function startBackend(port = 0) {
  let title = "IT Arena SSR fixture";
  let subdomain: string | undefined = "itarena";
  let published = true;
  let description = "Owner-only description";
  let galleryId = "test-collection";
  let imagesCount = 2742;
  let showAllPhotos = true;
  let timestamp = 0;
  const sockets = new Set<ServerWebSocket<SocketData>>();
  const collection = () => ({
    _id: galleryId, _creationTime: 1700000000000, ...(subdomain ? { subdomain } : {}),
    title, description, imagesCount, published, showAllPhotos,
    status: "complete", previewImages: ["test-collection/photo-001.jpg"], createdBy: "owner",
  });
  const publicView = (id: string) => id === galleryId
    ? published ? { ...publicGallery("test-collection"), ...collection() } : null
    : publicGallery(id);
  // Uploads the dashboard starts, the batches it registers, and the photos it puts in R2
  const uploads: Array<Record<string, unknown> & { _id: string; sent: number }> = [];
  const batches: Array<{ uploadId: string; first: number; names: string[] }> = [];
  const putKeys: string[] = [];
  function mutate(path: string, args: Record<string, any>) {
    if (path === "collections:create") {
      galleryId = "private-collection";
      title = args.title;
      description = args.description;
      subdomain = undefined;
      published = false;
      imagesCount = 0;
      return galleryId;
    }
    if (path === "collections:update") {
      title = args.title;
      description = args.description;
      subdomain = args.subdomain || undefined;
      showAllPhotos = args.showAllPhotos ?? showAllPhotos;
    }
    if (path === "collections:setPublished") published = args.published;
    if (path === "uploads:start") {
      const upload = { _id: `upload-${uploads.length + 1}`, _creationTime: Date.now(), ...args, sent: 0, processed: 0, saved: 0, failed: 0 };
      uploads.unshift(upload);
      return { uploadId: upload._id, sent: 0 };
    }
    if (path === "uploads:addBatch") {
      batches.push(args as typeof batches[number]);
      const upload = uploads.find((item) => item._id === args.uploadId)!;
      upload.sent = args.first + args.names.length;
    }
    return null;
  }
  const result = (path: string) => path === "uploads:list" ? uploads
    : path === "collections:getAll" ? [collection()]
    : path === "balances:mine" ? { credit: 3250, paid: false }
    : path === "searchRequests:get" ? { _id: "fixture-search", collectionId: "test-collection", status: "complete", imagesFound: FOUND }
    : path === "collections:getPublicBySubdomain" ? publicView(galleryId)
    : collection();
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
    if (new URL(request.url).pathname === "/__fixture/uploads") return Response.json({ uploads, batches, putKeys });
    if (new URL(request.url).pathname === "/__fixture/title") {
      title = await request.text();
      for (const socket of sockets) transition(socket);
      return new Response("Updated");
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.replace(/\/$/, "") === "/r2/fixture-bucket" && url.searchParams.get("list-type") === "2") return listBucket(url);
    // The browser puts photos straight into R2 with signed links, across origins like the real bucket.
    const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "PUT", "access-control-allow-headers": "content-type" };
    if (path.startsWith("/r2/fixture-bucket/") && request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (path.startsWith("/r2/fixture-bucket/") && request.method === "PUT") {
      await request.arrayBuffer();
      putKeys.push(decodeURIComponent(path.slice("/r2/fixture-bucket/".length)));
      return new Response(null, { headers: cors });
    }
    if (path.startsWith("/r2/fixture-bucket/")) {
      const index = BUCKET_KEYS.indexOf(decodeURIComponent(path.slice("/r2/fixture-bucket/".length)));
      if (index < 0) return new Response("NoSuchKey", { status: 404 });
      return new Response(Bun.file(new URL(`../public/landing/${SAMPLES[index % SAMPLES.length]}.jpg`, import.meta.url)));
    }
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
      if (body.path === "searchRequests:create" && body.args[0].collectionId === "private-collection" && request.headers.get("authorization") !== `Bearer ${ownerJwt}`) {
        return Response.json({ status: "error", errorMessage: "Uncaught ConvexError", errorData: "This gallery is private", logLines: [] });
      }
      if (body.path === "searchRequests:create" && body.args[0].collectionId === "paused-collection") {
        return Response.json({ status: "error", errorMessage: "Uncaught ConvexError", errorData: "Searching is paused for this gallery. Please ask its owner to top up.", logLines: [] });
      }
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
      if (body.path === "collections:getPublicBySubdomain") return Response.json({ status: "success", value: publicView(galleryId), logLines: [] });
      if (body.path === "collections:getPublic") return Response.json({ status: "success", value: publicView(body.args[0].id), logLines: [] });
      if (body.path === "searchRequests:authorizeImages") return Response.json({ status: "success", value: (body.args[0].id === "fixture-search" || (body.args[0].id === "private-search" && request.headers.get("authorization") === `Bearer ${ownerJwt}`)) && body.args[0].keys.every((key: string) => FOUND.includes(key)), logLines: [] });
      if (request.headers.get("authorization") !== `Bearer ${ownerJwt}`) return new Response(null, { status: 401 });
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
      if (message.type === "Mutation") {
        // The client resolves a mutation once it sees a transition at the mutation's timestamp, so one follows.
        const ts = Buffer.alloc(8);
        ts.writeBigUInt64LE(BigInt(timestamp + 1));
        const value = mutate(message.udfPath, message.args[0] as Record<string, any>);
        socket.send(JSON.stringify({ type: "MutationResponse", requestId: message.requestId, success: true, result: value, ts: ts.toString("base64"), logLines: [] }));
        for (const each of sockets) transition(each);
      }
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

