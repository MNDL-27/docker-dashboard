import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import { createHash } from "crypto";
import fs from "fs";

/**
 * Vite plugin that generates a `/version.json` file in the build output
 * containing a unique build hash. The client-side `useAppUpdate` hook polls
 * this file to detect new deployments and prompt the user to reload.
 */
function buildVersionPlugin(): Plugin {
  const buildHash = createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 12);

  return {
    name: "build-version",
    config() {
      return {
        define: {
          "import.meta.env.VITE_BUILD_HASH": JSON.stringify(buildHash),
        },
      };
    },
    writeBundle(options) {
      const outDir = options.dir ?? "dist";
      const versionPayload = JSON.stringify(
        { hash: buildHash, builtAt: new Date().toISOString() },
        null,
        2
      );
      fs.writeFileSync(path.resolve(outDir, "version.json"), versionPayload);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: "apps/frontend",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    buildVersionPlugin(),
    ...(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })]
      : []),
  ],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split large vendor libraries into separate cacheable chunks.
          // Using a function-based approach (not object-based) to avoid
          // the 'Cannot access X before initialization' circular dependency
          // issue that can occur with object-based manualChunks + Clerk.
          if (id.includes('node_modules')) {
            // IMPORTANT: Do NOT split React or ReactDOM into their own chunk.
            // Many libraries (Clerk, Radix, framer-motion, etc.) expect React
            // to be in the same initialization scope. Splitting React out causes
            // 'Cannot read properties of undefined (reading useLayoutEffect)'
            // at runtime due to module initialization ordering issues.
            if (id.includes('@clerk')) return 'vendor-clerk';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('date-fns')) return 'vendor-date';
            if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('zod')) return 'vendor-validation';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('react-hook-form') || id.includes('@hookform')) return 'vendor-forms';
            if (id.includes('cmdk') || id.includes('vaul') || id.includes('sonner') || id.includes('embla')) return 'vendor-ui';
            if (id.includes('tailwind-merge') || id.includes('clsx') || id.includes('class-variance-authority') || id.includes('tailwindcss-animate')) return 'vendor-utils';
            if (id.includes('react-resizable-panels') || id.includes('input-otp') || id.includes('react-day-picker') || id.includes('next-themes')) return 'vendor-ui-extras';
            // react, react-dom stay in the main chunk to avoid initialization
            // ordering issues with Clerk, Radix, framer-motion, etc.
            return 'vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/frontend/src"),
    },
  },
}));
