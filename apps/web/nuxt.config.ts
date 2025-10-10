// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: false },
  modules: ["@nuxtjs/tailwindcss", "shadcn-nuxt", "convex-nuxt"],
  css: ["~/assets/css/tailwind.css"],
  devServer: {
    port: 3001,
  },
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
  runtimeConfig: {
    r2AccountId: process.env.NUXT_R2_ACCOUNT_ID,
    r2BucketName: process.env.NUXT_R2_BUCKET_NAME,
    r2AccessKeyId: process.env.NUXT_R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.NUXT_R2_SECRET_ACCESS_KEY,
    public: {
      origin: process.env.NUXT_PUBLIC_ORIGIN,
      convexUrl: process.env.NUXT_PUBLIC_CONVEX_URL,
      apiURL: process.env.NUXT_PUBLIC_API_URL,
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
