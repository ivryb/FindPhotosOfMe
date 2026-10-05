export default defineNuxtPlugin(() => {
  const authClient = useAuthClient();
  const convex = useConvexClient();
  const session = authClient.useSession();
  const authenticated = useState("convexAuthenticated", () => false);
  let currentSession: string | null | undefined;

  function redirectToSignIn() {
    if (window.location.pathname.startsWith("/admin")) {
      window.location.replace(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }

  watch(
    () => [session.value.data?.session.id, session.value.isPending] as const,
    ([sessionId, pending]) => {
      if (pending) return;
      const nextSession = sessionId ?? null;
      if (nextSession === currentSession) return;
      // Never reuse the previous account's dashboard after sign-out or an account switch.
      if (currentSession !== undefined || !nextSession) clearNuxtData("dashboard");
      currentSession = nextSession;
      authenticated.value = false;
      if (sessionId) {
        convex.setAuth(getConvexAuthToken, (value) => {
          authenticated.value = value;
          if (!value) redirectToSignIn();
        });
      } else {
        convex.setAuth(async () => null);
        redirectToSignIn();
      }
    },
    { immediate: true },
  );
});
