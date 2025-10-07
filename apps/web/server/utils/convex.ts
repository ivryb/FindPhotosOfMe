import { ConvexClient } from "convex/browser";

export const getConvexClient = () => {
  const config = useRuntimeConfig();
  const convexUrl = config.public.convexUrl;

  return new ConvexClient(convexUrl) as ConvexClient;
};
