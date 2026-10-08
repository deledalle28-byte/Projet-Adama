import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Le lecteur de visite : un fichier HTML autonome, sans l'éditeur. Il sert
 * de gabarit au carnet, qui y glisse le scénario choisi au moment de
 * l'export (« Exporter la visite »). Construit AVANT le carnet.
 * `npm run build:visite` → dist-visite/visite.html
 */
export default defineConfig({
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  base: "./",
  build: {
    outDir: "dist-visite",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
    rollupOptions: { input: "visite.html", output: { inlineDynamicImports: true } },
  },
});
