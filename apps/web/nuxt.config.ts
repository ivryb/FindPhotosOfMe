// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-10-01",
  nitro: {
    preset: "cloudflare_module",
    cloudflare: {
      deployConfig: true,
      nodeCompat: true,
    },
  },
  routeRules: {
    "/admin": { headers: { "cache-control": "private, no-store" } },
    "/admin/**": { headers: { "cache-control": "private, no-store" } },
    "/api/admin/**": { headers: { "cache-control": "private, no-store" } },
    "/api/auth/**": { headers: { "cache-control": "private, no-store" } },
  },
  devtools: { enabled: false },
  modules: ["shadcn-nuxt", "convex-nuxt"],
  css: ["~/assets/css/tailwind.css"],
  devServer: {
    port: 3001,
  },
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
  runtimeConfig: {
    serviceToken: "",
    pythonApiUrl: "",
    r2AccountId: "",
    r2BucketName: "",
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    public: {
      origin: "",
      convexUrl: "",
      convexSiteUrl: "",
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  shadcn: {
    prefix: "",
    componentDir: "./app/components/ui",
  },
});
