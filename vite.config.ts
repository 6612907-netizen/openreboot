import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 纯静态产物：任何静态文件服务器都能自托管（nginx / GitHub Pages / `npx serve dist`）。
// base 用相对路径，便于放进子目录（如 Pages 的 /OpenReboot/）而无需改代码。
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
  },
});
