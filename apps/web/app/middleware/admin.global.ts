export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith("/admin") || import.meta.server) return;

  const { data } = await useAuthClient().getSession();
  if (!data?.session) {
    return navigateTo({ path: "/sign-in", query: { redirect: to.fullPath } });
  }
});
