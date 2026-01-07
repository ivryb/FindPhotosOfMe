export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<{ password?: string }>(event);

  if (!config.adminPassword) {
    throw createError({
      statusCode: 500,
      statusMessage: "NUXT_ADMIN_PASSWORD not configured",
    });
  }

  if (body?.password !== config.adminPassword) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid password",
    });
  }

  return { success: true };
});
