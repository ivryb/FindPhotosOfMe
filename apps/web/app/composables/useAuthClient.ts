import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/vue";

let client: ReturnType<typeof createClient> | undefined;

function createClient() {
  const config = useRuntimeConfig();
  if (!config.public.convexSiteUrl) throw new Error("NUXT_PUBLIC_CONVEX_SITE_URL is not configured");
  return createAuthClient({
    baseURL: config.public.convexSiteUrl,
    plugins: [emailOTPClient(), convexClient(), crossDomainClient()],
  });
}

export function useAuthClient() {
  client ??= createClient();
  return client;
}

export async function getConvexAuthToken(forceRefresh = false) {
  void forceRefresh;
  const { data } = await useAuthClient().convex.token({ fetchOptions: { throw: false } });
  return data?.token ?? null;
}
