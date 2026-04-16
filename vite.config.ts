import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@clerk")) {
            return "clerk";
          }

          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }

          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("embla-carousel")) {
            return "ui-vendor";
          }

          if (id.includes("@tanstack/react-query") || id.includes("react-router") || id.includes("react-dom") || id.match(/[\\/]react[\\/]/)) {
            return "react-vendor";
          }

          if (id.includes("react-hook-form") || id.includes("@hookform/resolvers") || id.includes("zod")) {
            return "forms";
          }

          if (id.includes("three")) {
            return "three-vendor";
          }

          if (id.includes("next-themes") || id.includes("sonner") || id.includes("input-otp")) {
            return "ux-vendor";
          }

          if (id.includes("react-day-picker") || id.includes("date-fns")) {
            return "date-vendor";
          }

          if (id.includes("lucide-react") || id.includes("date-fns") || id.includes("framer-motion")) {
            return "app-vendor";
          }

          return "vendor";
        },
      },
    },
  },
}));
