// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src")
      }
    },
    server: {
      port: 30001,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:23333",
          changeOrigin: true
        }
      }
    },
    plugins: [vue(), tailwindcss()]
  }
});
export {
  electron_vite_config_default as default
};
