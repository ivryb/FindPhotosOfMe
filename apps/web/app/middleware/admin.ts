export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith("/admin")) return;

  const authenticated = useCookie("admin-auth");
  if (authenticated.value !== "true") {
    return navigateTo("/admin-login");
  }
});
