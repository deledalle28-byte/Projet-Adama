import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Un seul mode de build : UN fichier HTML autonome (JS, CSS et fond de
 * carte inlinés), à double-cliquer, sans installation ni réseau.
 * `npm run build` → dist/carnet-de-route.html
 */
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  base: "./",
  build: {
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
