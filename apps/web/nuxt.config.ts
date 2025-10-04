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
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2BucketName: process.env.R2_BUCKET_NAME,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    public: {
      serverURL: process.env.NUXT_PUBLIC_SERVER_URL,
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
