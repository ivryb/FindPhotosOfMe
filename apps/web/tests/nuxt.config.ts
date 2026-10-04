import config from "../nuxt.config";

export default defineNuxtConfig({
  ...config,
  srcDir: "../app",
  serverDir: "../server",
  dir: { shared: "../shared" },
  devtools: { enabled: false },
  nitro: { preset: "node-server" },
  convex: { url: process.env.TEST_BACKEND_URL },
  runtimeConfig: {
    public: {
      convexUrl: process.env.TEST_BACKEND_URL,
      convexSiteUrl: process.env.TEST_BACKEND_URL,
    },
  },
});
