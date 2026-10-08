import { ConvexError } from "convex/values";

/**
 * Why one of our server routes refused a request (a 409), meant for people.
 * It's read from the response body: over HTTP/2 the status text, where h3 also puts it, is always empty.
 */
export function refusal(error: unknown) {
  const { statusCode, data } = (error ?? {}) as { statusCode?: number; data?: { message?: string } };
  return statusCode === 409 && data?.message ? data.message : undefined;
}

/** What to tell people when a call fails: its own words when they're meant for people, otherwise a plain apology. */
export function readableError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return refusal(error) ?? fallback;
}

/**
 * Runs `request` again after a dropped connection or a server hiccup, waiting 2, 4, then 8 seconds between tries.
 * Answers meant for people and other refusals fail at once.
 */
export async function retrying<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const { statusCode } = (error ?? {}) as { statusCode?: number };
      const transient = !(error instanceof ConvexError) && (statusCode === undefined || statusCode === 429 || statusCode >= 500);
      if (!transient || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}
