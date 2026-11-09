import { execSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function resolveCommit(): string {
  const fromEnvironment =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VITE_COMMIT_SHA ||
    process.env.GITHUB_SHA;

  if (fromEnvironment) {
    return fromEnvironment.trim();
  }

  try {
    return execSync("git rev-parse HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function resolveEnvironment(): string {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV.trim();
  }

  if (process.env.CI) {
    return "ci";
  }

  return "local";
}

const commit = resolveCommit();
const environment = resolveEnvironment();

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_COMMIT_SHORT__: JSON.stringify(commit.slice(0, 7)),
    __APP_ENV__: JSON.stringify(environment),
  },
  server: {
    host: true,
    port: 3000,
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
