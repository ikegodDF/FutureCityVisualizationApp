import { defineConfig } from "vite";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [cesium()],
  publicDir: "public",
  // SPAフォールバックを無効化して静的配信の優先度を上げる
  appType: "mpa",
  server: {
    host: true,
    port: 5173,
  },
});
