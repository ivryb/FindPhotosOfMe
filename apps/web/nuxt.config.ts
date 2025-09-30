// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "latest",
	devtools: { enabled: true },
	modules: ["@nuxt/ui", "convex-nuxt"],
	css: ["~/assets/css/main.css"],
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
});
