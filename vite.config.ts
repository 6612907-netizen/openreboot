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
    // 必须同时收 .ts 与 .tsx：只写 *.test.ts 会把界面测试静默排除在外，
    // 于是"全绿"里根本没有包含 UI 那部分 —— 正是本项目明令禁止的空集判绿形状。
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
