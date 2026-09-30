import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Gestor de hábitos y finanzas",
        short_name: "Hábitos",
        description: "App personal para seguir hábitos y finanzas.",
        lang: "es",
        dir: "ltr",
        start_url: "/",
        display: "standalone",
        background_color: "#eef2f7",
        theme_color: "#4f46e5",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,ico,woff2}"],
        navigateFallback: "/index.html",
        // No servir el shell de la SPA para rutas /api: una navegación manual a
        // /api/... debe llegar a la función, no quedar enmascarada por index.html.
        navigateFallbackDenylist: [/^\/api\//, /^\/api$/],
        runtimeCaching: [
          {
            // Nunca servir datos financieros desde caché: la API siempre va a red.
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});
