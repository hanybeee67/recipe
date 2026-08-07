import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 정적 호스팅(GitHub Pages 등) 어디에 올려도 동작하도록 상대 경로 base 를 쓴다.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});
