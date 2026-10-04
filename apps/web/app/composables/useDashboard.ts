import { api } from "@FindPhotosOfMe/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { InjectionKey } from "vue";

type Loaded = {
  galleries: FunctionReturnType<typeof api.collections.getAll>;
  balance: FunctionReturnType<typeof api.balances.mine>;
  covers: Record<string, string>;
};

type Dashboard = ReturnType<typeof liveDashboard>;
const DASHBOARD: InjectionKey<Dashboard> = Symbol("dashboard");

/**
 * Loads the owner's galleries and balance, rendered on the server from the session cookie and kept live afterwards,
 * and shares them with every dashboard page. Called once by pages/admin.vue, so moving between pages keeps the live data.
 * Anonymous visitors are sent to sign in before anything private renders.
 */
export async function provideDashboard() {
  // Nuxt and Vue composables only work before the first await, so everything is set up before waiting for the data.
  const nuxtApp = useNuxtApp();
  const route = useRoute();
  const responseCookies = import.meta.server ? useResponseHeader("set-cookie") : undefined;
  const request = useFetch<Loaded>("/api/admin/dashboard", {
    key: "dashboard",
    onResponse({ response }) {
      const cookies = response.headers.getSetCookie();
      if (responseCookies && cookies.length) responseCookies.value = cookies;
    },
  });
  provide(DASHBOARD, liveDashboard(request.data));

  const { error } = await request;
  if (error.value?.statusCode === 401) {
    await nuxtApp.runWithContext(() => navigateTo({ path: "/sign-in", query: { redirect: route.fullPath } }));
  } else if (error.value) {
    throw createError({ statusCode: error.value.statusCode, statusMessage: "Could not load your galleries" });
  }
}

/** The dashboard's shared state: live galleries and balance, and the dialogs any page can open. */
export function useDashboard() {
  return inject(DASHBOARD)!;
}

function liveDashboard(loaded: Ref<Loaded | undefined>) {
  const galleries = useLiveQuery(api.collections.getAll, {}, computed(() => loaded.value?.galleries));
  const balance = useLiveQuery(api.balances.mine, {}, computed(() => loaded.value?.balance));
  return {
    galleries: computed(() => galleries.data.value ?? []),
    credit: computed(() => balance.data.value?.credit ?? 0),
    covers: computed(() => loaded.value?.covers ?? {}),
    failed: computed(() => Boolean(galleries.error.value || balance.error.value)),
    creating: ref(false),
    toppingUp: ref(false),
  };
}
