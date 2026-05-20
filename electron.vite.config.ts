import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin, loadEnv } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd())
    const serverPort = Number(env.VITE_SERVER_PORT || 23333)
    const webPort = Number(env.VITE_WEB_PORT || 30001)

    return {
        main: {
            plugins: [externalizeDepsPlugin(), bytecodePlugin()]
        },
        preload: {
            plugins: [externalizeDepsPlugin(), bytecodePlugin()]
        },
        renderer: {
            resolve: {
                alias: {
                    '@renderer': resolve('src/renderer/src')
                }
            },
            server: {
                port: webPort,
                proxy: {
                    "/api": {
                        target: `http://127.0.0.1:${serverPort}`,
                        changeOrigin: true,
                    },
                },
            },
            plugins: [vue(), tailwindcss()]
        }
    }
})
