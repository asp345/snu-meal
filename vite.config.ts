import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  publicDir: "src/web/assets",
  build: {
    outDir: "public",
    emptyOutDir: false,
    target: "es2022",
  },
});
