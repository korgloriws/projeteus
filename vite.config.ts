import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const port = Number(process.env.WEB_PORT ?? 5173);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  envDir: path.resolve(import.meta.dirname),
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@api": path.resolve(import.meta.dirname, "api"),
      "@db": path.resolve(import.meta.dirname, "db/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://localhost:8080",
        changeOrigin: true,
        bypass(req) {
          const url = req.url?.split("?")[0] ?? "";
          // Não proxyar módulos do cliente gerado (pasta api/) — só rotas HTTP da API
          if (/\.(ts|tsx|js|mjs)$/.test(url) || url.startsWith("/api/generated/")) {
            return req.url;
          }
        },
      },
    },
  },
  preview: {
    port,
    host: true,
  },
});
