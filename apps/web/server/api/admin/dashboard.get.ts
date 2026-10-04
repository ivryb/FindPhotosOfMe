import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";

/**
 * Everything the dashboard shows on every page: the owner's galleries, their shared balance,
 * and a signed thumbnail of each gallery's first photo for the sidebar.
 */
export default defineEventHandler(async (event) => {
  const client = await getCookieAuthenticatedConvex(event);
  const [galleries, balance] = await Promise.all([
    client.query(api.collections.getAll, {}),
    client.query(api.balances.mine, {}),
  ]);
  const r2 = useR2(event);
  const covers = Object.fromEntries(await Promise.all(galleries.flatMap((gallery) => {
    const first = gallery.previewImages?.[0];
    return first ? [r2.photoLinks(first).then((links) => [gallery._id, links.thumb] as const)] : [];
  })));
  return { galleries, balance, covers };
});
