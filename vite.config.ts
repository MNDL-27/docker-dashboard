import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router')) {
              return 'vendor-react';
            }
            if (id.includes('/@clerk/')) {
              return 'vendor-clerk';
            }
            if (id.includes('/recharts/') || id.includes('/d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('/@tanstack/')) {
              return 'vendor-query';
            }
            if (id.includes('/@radix-ui/')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
