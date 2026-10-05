export default defineNuxtPlugin(() => {
  const authClient = useAuthClient();
  const convex = useConvexClient();
  const session = authClient.useSession();
  const authenticated = useState("convexAuthenticated", () => false);
  const interrupted = useState("authInterrupted", () => false);
  let currentSession: string | null | undefined;
  let reconnect = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  function retrySessionCheck() {
    interrupted.value = true;
    clearTimeout(retry);
    retry = setTimeout(() => { void session.value.refetch(); }, 5000);
  }

  function redirectToSignIn() {
    if (window.location.pathname.startsWith("/admin")) {
      window.location.replace(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }

  watch(
    () => [session.value.data?.session.id, session.value.isPending, session.value.isRefetching, session.value.error] as const,
    ([sessionId, pending, refetching, error]) => {
      if (pending || refetching) return;
      // A failed initial check has no session data even when the persistent login is still valid.
      if (error && error.status !== 401) {
        retrySessionCheck();
        return;
      }
      clearTimeout(retry);
      const nextSession = sessionId ?? null;
      if (nextSession === currentSession && !reconnect) {
        if (authenticated.value || !nextSession) interrupted.value = false;
        return;
      }
      // Never reuse the previous account's dashboard after sign-out or an account switch.
      if (nextSession !== currentSession && (currentSession !== undefined || !nextSession)) clearNuxtData("dashboard");
      currentSession = nextSession;
      reconnect = false;
      authenticated.value = false;
      if (sessionId) {
        convex.setAuth(getConvexAuthToken, (value) => {
          authenticated.value = value;
          interrupted.value = !value;
          // Token/network failures don't prove that the login expired; confirm it through Better Auth first.
          if (!value) {
            reconnect = true;
            retrySessionCheck();
          }
        });
      } else {
        interrupted.value = false;
        convex.setAuth(async () => null);
        redirectToSignIn();
      }
    },
    { immediate: true },
  );
});
