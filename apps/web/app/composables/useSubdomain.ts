export const useSubdomain = () => {
  const url = useRequestURL();
  const route = useRoute();
  const origin = useRuntimeConfig().public.origin;

  if (import.meta.dev && typeof route.query.subdomain === "string") {
    return route.query.subdomain;
  }

  if (!origin) return undefined;
  const rootHost = new URL(origin).hostname;
  const suffix = `.${rootHost}`;
  if (!url.hostname.endsWith(suffix)) return undefined;

  const subdomain = url.hostname.slice(0, -suffix.length);
  if (!subdomain || subdomain === "www" || subdomain.includes(".")) return undefined;
  return subdomain;
};
