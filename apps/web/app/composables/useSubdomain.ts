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

/**
 * Where galleries live: `host` is what follows a gallery's address (as in harbor.<host>), and `link` gives a gallery's
 * public page. Without a configured origin (in development), galleries open on this site with a query instead.
 */
export const useGalleryAddress = () => {
  const origin = useRuntimeConfig().public.origin;
  const here = useRequestURL();
  const root = origin ? new URL(origin) : undefined;
  return {
    host: root?.host ?? here.host,
    link: (subdomain: string) => (root ? `${root.protocol}//${subdomain}.${root.host}` : `${here.origin}/search?subdomain=${subdomain}`),
  };
};
