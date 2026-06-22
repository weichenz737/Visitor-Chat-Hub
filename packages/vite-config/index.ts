import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

type CreateAppViteConfigOptions = {
  /** Default dev server port when PORT env is unset */
  defaultPort: number;
};

export function createAppViteConfig(metaUrl: string, options: CreateAppViteConfigOptions) {
  const appDir = path.dirname(fileURLToPath(metaUrl));
  const monorepoRoot = path.resolve(appDir, "../..");
  const uiSrc = path.resolve(monorepoRoot, "packages/ui/src");

  const rawPort = process.env.PORT ?? String(options.defaultPort);
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? "/";
  const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";
  const wsProxyTarget = apiProxyTarget.replace(/^http/, "ws");

  return defineConfig({
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: "@/components/ui", replacement: path.join(uiSrc, "components/ui") },
        { find: "@/lib/utils", replacement: path.join(uiSrc, "lib/utils.ts") },
        { find: "@/hooks/use-toast", replacement: path.join(uiSrc, "hooks/use-toast.ts") },
        { find: "@/hooks/use-mobile", replacement: path.join(uiSrc, "hooks/use-mobile.tsx") },
        { find: "@", replacement: path.resolve(appDir, "src") },
        { find: "@ui", replacement: uiSrc },
      ],
      dedupe: ["react", "react-dom"],
    },
    root: appDir,
    build: {
      outDir: path.resolve(appDir, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      // Docker bind mounts (especially on Windows) often miss fs events — poll instead.
      watch: process.env.CI === "true" ? { usePolling: true, interval: 800 } : undefined,
      proxy: {
        "/api": { target: apiProxyTarget, changeOrigin: true },
        "/ws": { target: wsProxyTarget, ws: true },
        "/uploads": { target: apiProxyTarget, changeOrigin: true },
        "/storage": { target: apiProxyTarget, changeOrigin: true },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  });
}
