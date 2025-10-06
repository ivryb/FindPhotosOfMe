import { ConvexClient } from "convex/browser";
import type { Doc } from "@FindPhotosOfMe/backend/convex/_generated/dataModel";
import { log } from "./log";

type SearchDoc = Doc<"searchRequests"> | null;

export const waitForSearch = async (
  requestId: string,
  timeoutMs: number,
  onUpdate?: (doc: NonNullable<SearchDoc>) => void | Promise<void>
) => {
  const config = useRuntimeConfig();
  const subClient = new ConvexClient(config.public.convexUrl);
  return await new Promise<SearchDoc>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      log("Subscription timed out", { requestId: String(requestId) });
      try {
        subClient.close();
      } catch {}
      resolve(null);
    }, timeoutMs);

    const maybeUnsub = (subClient as any).onUpdate(
      "searchRequests:get",
      { id: requestId },
      (doc: SearchDoc) => {
        if (!doc) return;
        try {
          if (onUpdate) void onUpdate(doc);
        } catch {}
        if (doc.status === "complete" || doc.status === "error") {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            if (typeof maybeUnsub === "function") maybeUnsub();
          } catch {}
          try {
            subClient.close();
          } catch {}
          resolve(doc);
        }
      }
    );
  });
};
