import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 정적 호스팅(GitHub Pages 등) 어디에 올려도 동작하도록 상대 경로 base 를 쓴다.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // 단일 파일 빌드에서만 true 로 바뀐다 (scripts/build-standalone.mjs)
  define: { __STANDALONE__: "false" },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
