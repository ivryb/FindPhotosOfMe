import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { Id } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") as Id<"collections"> | undefined;
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing event ID" });
  const convex = getAuthenticatedConvex(event);
  await convex.query(api.collections.canManage, { id });

  const r2 = useR2(event);
  const deleted = (await r2.deletePrefix(`${id}/`)) + (await r2.deletePrefix(`uploads/${id}/`));
  await convex.mutation(api.collections.deleteCollection, { id });
  return { deleted };
});
