export default defineNuxtPlugin(() => {
  const authClient = useAuthClient();
  const convex = useConvexClient();
  const session = authClient.useSession();
  const authenticated = useState("convexAuthenticated", () => false);

  function redirectToSignIn() {
    if (window.location.pathname.startsWith("/admin")) {
      window.location.replace(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }

  watch(
    () => [session.value.data?.session.id, session.value.isPending] as const,
    ([sessionId, pending]) => {
      if (pending) return;
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
