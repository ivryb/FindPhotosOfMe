// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss", "convex-nuxt", "shadcn-nuxt"],
  css: ["~/assets/css/tailwind.css"],
  devServer: {
    port: 3001,
  },
  ssr: true,
  convex: {
    url: process.env.NUXT_PUBLIC_CONVEX_URL,
  },
  runtimeConfig: {
    public: {
      serverURL: process.env.NUXT_PUBLIC_SERVER_URL,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./components/ui",
  },
});
