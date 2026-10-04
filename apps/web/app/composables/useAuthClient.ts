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
  const { data } = await useAuthClient().convex.token({ fetchOptions: { throw: false } });
  return data?.token ?? null;
}
