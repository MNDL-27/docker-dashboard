import { defineWorkspace } from "vitest/config";
import path from "path";

const root = path.resolve(__dirname);

export default defineWorkspace([
  {
    test: {
      name: "frontend",
      root: path.join(root, "apps/frontend"),
      environment: "happy-dom",
      include: ["src/**/*.test.{ts,tsx}"],
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        reportsDirectory: path.join(root, "coverage/frontend"),
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/**/*.d.ts",
          "src/main.tsx",
          "src/vite-env.d.ts",
        ],
      },
    },
    resolve: {
      alias: {
        "@": path.join(root, "apps/frontend/src"),
      },
    },
  },
  {
    test: {
      name: "backend",
      root: path.join(root, "apps/backend"),
      environment: "node",
      include: ["netlify/functions/**/*.test.{ts,tsx,mts}"],
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        reportsDirectory: path.join(root, "coverage/backend"),
        include: ["netlify/functions/**/*.{ts,mts}"],
        exclude: [
          "netlify/functions/**/*.test.{ts,tsx,mts}",
          "netlify/functions/**/*.d.ts",
        ],
      },
    },
  },
  {
    test: {
      name: "shared",
      root: path.join(root, "shared"),
      environment: "node",
      include: ["**/*.test.{ts,tsx}"],
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov"],
        reportsDirectory: path.join(root, "coverage/shared"),
        include: ["**/*.{ts,tsx}"],
        exclude: [
          "**/*.test.{ts,tsx}",
          "**/*.d.ts",
        ],
      },
    },
  },
]);