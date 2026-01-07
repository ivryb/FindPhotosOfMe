import type { H3Event } from "h3";

export function requireAdminAuth(event: H3Event): void {
  const config = useRuntimeConfig();
  const password = getHeader(event, "x-admin-password");

  if (!config.adminPassword) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_ADMIN_PASSWORD not configured",
    });
  }

  if (password !== config.adminPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }
}
