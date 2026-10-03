export default defineNuxtPlugin(async () => {
  const authClient = useAuthClient();
  const convex = useConvexClient();
  const session = authClient.useSession();

  const route = useRoute();
  const oneTimeToken = route.query.ott;

  if (typeof oneTimeToken === "string") {
    const result = await authClient.crossDomain.oneTimeToken.verify({
      token: oneTimeToken,
    });
    const token = result.data?.session.token;

    if (token) {
      await authClient.getSession({
        fetchOptions: { headers: { Authorization: `Bearer ${token}` } },
      });
      authClient.updateSession();
    }

    const query = { ...route.query };
    delete query.ott;
    await navigateTo({ path: route.path, query }, { replace: true });
  }

  const fetchToken = async ({ forceRefreshToken = false } = {}) =>
    getConvexAuthToken(forceRefreshToken);

  watch(
    () => session.value.data?.session.id,
    (sessionId) => {
      if (sessionId) convex.setAuth(fetchToken);
      else if (!session.value.isPending) convex.setAuth(async () => null);
    },
    { immediate: true }
  );
});
