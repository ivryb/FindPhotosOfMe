export const useSubdomain = () => {
  const url = useRequestURL();
  const route = useRoute();

  if (route.query.subdomain) {
    return route.query.subdomain as string;
  }

  const subdomain = url.hostname.split(".")[0];

  if (subdomain === "localhost" || subdomain === "findphotosofme") {
    return undefined;
  }

  return subdomain;
};
