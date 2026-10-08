import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";

let client: ReturnType<typeof createClient> | undefined;

function createClient(origin: string) {
  return createAuthClient({
    baseURL: origin,
    plugins: [emailOTPClient(), convexClient()],
  });
}

export function useAuthClient() {
  // Server renders must never share a user's auth state with another request.
  if (import.meta.server) return createClient(useRequestURL().origin);
  return client ??= createClient(window.location.origin);
}

export async function getConvexAuthToken() {
  try {
    const { data } = await useAuthClient().convex.token({ fetchOptions: { throw: false } });
    return data?.token ?? null;
  } catch {
    // Network errors still throw with throw:false. Let the auth plugin recheck the session and reconnect.
    return null;
  }
}

/** Signs a request to our own API routes. A missing token reads as signed out there, so brief failures are waited out. */
export async function authHeaders() {
  const token = await retrying(async () => {
    const token = await getConvexAuthToken();
    if (!token) throw new Error("Could not verify your session");
    return token;
  });
  return { Authorization: `Bearer ${token}` };
}
