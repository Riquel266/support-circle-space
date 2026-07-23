import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
    target: "es2020",
    rollupOptions: {
      input: "index.html",
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
