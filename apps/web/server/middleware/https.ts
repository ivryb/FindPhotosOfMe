export default defineEventHandler((event) => {
  const origin = useRuntimeConfig(event).public.origin;
  if (!origin) return;
  const root = new URL(origin);
  const url = getRequestURL(event);
  if (root.protocol !== "https:" || (url.hostname !== root.hostname && !url.hostname.endsWith(`.${root.hostname}`))) return;

  // Safari could open the site over HTTP despite its valid certificate. Keep event hosts, paths, and query strings intact.
  // www kept its own sign-in cookies, so the dashboard there looked signed out; it moves to the main host.
  const www = url.hostname === `www.${root.hostname}`;
  if (url.protocol === "http:" || www) {
    url.protocol = "https:";
    if (www) url.hostname = root.hostname;
    return sendRedirect(event, url.href, 308);
  }
});
