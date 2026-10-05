export default defineEventHandler((event) => {
  const origin = useRuntimeConfig(event).public.origin;
  if (!origin) return;
  const root = new URL(origin);
  const url = getRequestURL(event);
  if (root.protocol !== "https:" || (url.hostname !== root.hostname && !url.hostname.endsWith(`.${root.hostname}`))) return;

  // Safari could open the site over HTTP despite its valid certificate. Keep event hosts, paths, and query strings intact.
  if (url.protocol === "http:") {
    url.protocol = "https:";
    return sendRedirect(event, url.href, 308);
  }
});
