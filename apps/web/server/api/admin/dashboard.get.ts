import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import { mediaLinks } from "#shared/utils/media";

/**
 * Everything the dashboard shows on every page: the owner's galleries, their shared balance,
 * and a thumbnail of each gallery's first photo for the sidebar.
 */
export default defineEventHandler(async (event) => {
  const client = await getCookieAuthenticatedConvex(event);
  const [galleries, balance] = await Promise.all([
    client.query(api.collections.getAll, {}),
    client.query(api.balances.mine, {}),
  ]);
  const covers: Record<string, string> = {};
  for (const gallery of galleries) {
    const first = gallery.previewImages?.[0];
    if (first) covers[gallery._id] = mediaLinks(first).thumb;
  }
  return { galleries, balance, covers };
});
