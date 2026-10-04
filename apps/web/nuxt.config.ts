// https://nuxt.com/docs/api/configuration/nuxt-config
import type { NuxtConfig } from "nuxt/schema";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import tailwindcss from "@tailwindcss/vite";

export default {
  compatibilityDate: "2025-10-01",
  nitro: {
    preset: "cloudflare_module",
    hooks: {
      "rollup:before": (nitro, config) => {
        if (nitro.options.dev || !Array.isArray(config.plugins)) return;
        // Workers need the SDK's browser runtime, including its package.json browser mappings.
        config.plugins = config.plugins.map((plugin) =>
          plugin && typeof plugin === "object" && "name" in plugin && plugin.name === "node-resolve"
            ? nodeResolve({
                browser: true,
                mainFields: ["browser", "module", "main"],
                exportConditions: nitro.options.exportConditions,
                preferBuiltins: false,
                rootDir: nitro.options.rootDir,
                modulePaths: nitro.options.nodeModulesDirs,
              })
            : plugin,
        );
      },
    },
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
} satisfies NuxtConfig;
