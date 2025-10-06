import { ConvexClient } from "convex/browser";
import { log } from "./log";

type SearchDoc = {
  _id: string;
  _creationTime: number;
  collectionId: string;
  status: "pending" | "processing" | "complete" | "error";
  imagesFound: string[];
  totalImages?: number;
  processedImages?: number;
  telegramChatId?: string;
} | null;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maybeUnsub: any = (subClient as any).onUpdate(
      "searchRequests:get" as any,
      { id: requestId as any },
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
