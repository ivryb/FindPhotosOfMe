export default defineNuxtRouteMiddleware((to) => {
  // Skip non-admin routes and the login page itself
  if (!to.path.startsWith("/admin") || to.path === "/admin-login") return;

  const authenticated = useCookie("admin-auth");
  if (authenticated.value !== "true") {
    return navigateTo("/admin-login");
  }
});
