import config from "../nuxt.config";

export default defineNuxtConfig({
  ...config,
  srcDir: "../app",
  serverDir: "../server",
  // The fixture root is tests/, but the app's logo and other public assets live alongside it.
  dir: { shared: "../shared", public: "../public" },
  devtools: { enabled: false },
  nitro: { preset: "node-server" },
  convex: { url: process.env.TEST_BACKEND_URL },
  runtimeConfig: {
    pythonApiUrl: process.env.TEST_BACKEND_URL,
    serviceToken: "fixture-service-token",
    r2AccountId: "fixture-account",
    r2BucketName: "fixture-bucket",
    r2AccessKeyId: "fixture-access-key",
    r2SecretAccessKey: "fixture-secret",
    r2Endpoint: `${process.env.TEST_BACKEND_URL}/r2`,
    public: {
      convexUrl: process.env.TEST_BACKEND_URL,
      convexSiteUrl: process.env.TEST_BACKEND_URL,
    },
  },
});
