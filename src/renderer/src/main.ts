import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'

import router from './router'
import { useSettingsStore, type Theme } from './stores/settings'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.mount('#app')

// 初始化主题
function applyTheme(theme: Theme) {
    let effectiveTheme: 'light' | 'dark'

    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        effectiveTheme = prefersDark ? 'dark' : 'light'
    } else {
        effectiveTheme = theme
    }

    if (effectiveTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
    } else {
        document.documentElement.removeAttribute('data-theme')
    }
}

// 初始化
const settingsStore = useSettingsStore()
applyTheme(settingsStore.theme)

// 监听主题变化
settingsStore.$subscribe(() => {
    applyTheme(settingsStore.theme)
})

// 监听系统主题变化（如果设置为 system）
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settingsStore.theme === 'system') {
        applyTheme('system')
    }
})
