import { ConvexClient } from "convex/browser";
// Avoid importing convex codegen; use string reference
import { log } from "./log.ts";
export const waitForSearch = async (convexUrl, requestId, timeoutMs) => {
    const subClient = new ConvexClient(convexUrl);
    return await new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
            if (done)
                return;
            done = true;
            log("Subscription timed out", { requestId: String(requestId) });
            try {
                subClient.close();
            }
            catch { }
            resolve(null);
        }, timeoutMs);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maybeUnsub = subClient.onUpdate("searchRequests:get", { id: requestId }, (doc) => {
            if (!doc)
                return;
            if (doc.status === "complete" || doc.status === "error") {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                try {
                    if (typeof maybeUnsub === "function")
                        maybeUnsub();
                }
                catch { }
                try {
                    subClient.close();
                }
                catch { }
                resolve(doc);
            }
        });
    });
};
//# sourceMappingURL=waitForSearch.js.map