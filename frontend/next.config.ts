import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// One .env at the repo root is shared by frontend and backend. Load it before
// Next evaluates the rest of the config so NEXT_PUBLIC_* vars get inlined.
// (On Vercel, env vars come from project settings and this is a harmless no-op.)
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
