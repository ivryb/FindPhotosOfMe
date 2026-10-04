import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";

export default defineEventHandler(async (event) => {
  const client = await getCookieAuthenticatedConvex(event);
  return client.query(api.collections.getAll, {});
});
