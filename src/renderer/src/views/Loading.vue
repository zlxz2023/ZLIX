<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logger } from '@renderer/utils/logger'

const statusMessage = ref('正在启动')
const hasError = ref(false)
const errorDetail = ref('')
const router = useRouter()

let isNavigating = false

const navigateToHome = () => {
    if (isNavigating) return
    isNavigating = true
    router.push('/main/home')
}

const initializeApp = async () => {
    try {
        hasError.value = false
        errorDetail.value = ''
        statusMessage.value = '正在初始化设置系统'
        await new Promise((resolve) => setTimeout(resolve, 200))

        statusMessage.value = '正在初始化音频播放器'
        const api = (window as any).api
        if (!api || !api.mpv) {
            throw new Error('MPV 播放器接口不可用')
        }
        // 等待 mpv 就绪，最多重试 3 次（每次 200ms）以避免 race condition
        let mpvState = null
        const maxAttempts = 3
        for (let i = 0; i < maxAttempts; i++) {
            try {
                // 若 handler 尚未注册或 mpv 未初始化，getState 可能返回 null 或抛错
                // 捕获异常并重试
                // @ts-ignore
                mpvState = await api.mpv.getState()
                if (mpvState !== null && mpvState !== undefined) break
            } catch (e) {
                // ignore and retry
            }
            await new Promise((resolve) => setTimeout(resolve, 200))
        }
        if (mpvState === null || mpvState === undefined) {
            throw new Error('MPV 播放器初始化失败：无法连接音频播放器')
        }
        await new Promise((resolve) => setTimeout(resolve, 400))

        statusMessage.value = '正在连接音乐服务器'
        await new Promise((resolve) => setTimeout(resolve, 200))

        statusMessage.value = '准备就绪'
        await new Promise((resolve) => setTimeout(resolve, 100))

        setTimeout(() => {
            navigateToHome()
        }, 500)
    } catch (error: any) {
        logger.error('Loading', '启动初始化失败', error)
        statusMessage.value = '启动失败'
        errorDetail.value = error.message || '未知错误'
        hasError.value = true
    }
}

onMounted(() => {
    initializeApp()
})
</script>

<template>
    <div class="loading-container select-none">
        <main class="loading-content">
            <div class="logo-wrapper">
                <img src="@renderer/assets/icon.png" alt="ZLIX" class="logo-icon" />
            </div>

            <div v-if="!hasError" class="loading-status">
                <div class="dots">
                    <span class="dot dot-1">·</span>
                    <span class="dot dot-2">·</span>
                    <span class="dot dot-3">·</span>
                </div>
                <p class="status-text">{{ statusMessage }}</p>
            </div>

            <div v-else class="error-state">
                <div class="error-icon">❌</div>
                <h2 class="error-title">启动失败</h2>
                <p class="error-message">{{ errorDetail }}</p>
                <button class="retry-btn" @click="initializeApp()">重试</button>
            </div>
        </main>

        <footer class="loading-footer">
            <span>ZLIX • 音乐播放器</span>
        </footer>
    </div>
</template>

<style scoped>
.loading-container {
    width: 100%;
    height: 100vh;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1;
}

.logo-wrapper {
    margin-bottom: 40px;
    animation: fadeInDown 0.8s ease-out;
}

.logo-icon {
    width: 240px;
    height: 240px;
    object-fit: contain;
    border-radius: 48px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.1);
}

.loading-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    animation: fadeIn 0.5s ease-out;
}

.status-text {
    font-size: 16px;
    color: #555555;
    margin: 0;
    letter-spacing: 2px;
    font-weight: 500;
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.status-text.updating {
    opacity: 0.6;
    transform: translateY(-4px);
}

.dots {
    display: flex;
    gap: 8px;
}

.dot {
    font-size: 32px;
    color: #ff6b9d;
    animation: bounceDot 1.8s ease-in-out infinite;
    font-weight: bold;
    line-height: 1;
}

.dot-1 {
    animation-delay: -0.32s;
}
.dot-2 {
    animation-delay: -0.16s;
}
.dot-3 {
    animation-delay: 0s;
}

.error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: fadeIn 0.5s ease-out;
}

.error-icon {
    font-size: 48px;
}

.error-title {
    font-size: 20px;
    color: #ef4444;
    margin: 0;
}

.error-message {
    font-size: 14px;
    color: #999999;
    margin: 0;
}

.retry-btn {
    margin-top: 20px;
    padding: 10px 24px;
    background: linear-gradient(135deg, #42d392 0%, #38bdf8 100%);
    border: none;
    border-radius: 20px;
    color: white;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
}

.retry-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 20px rgba(66, 211, 146, 0.4);
}

.loading-footer {
    position: absolute;
    bottom: 30px;
    font-size: 12px;
    color: #cccccc;
    letter-spacing: 1px;
    animation: fadeInUp 0.8s ease-out 0.5s both;
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes bounceDot {
    0%,
    80%,
    100% {
        transform: scale(0.6);
        opacity: 0.4;
    }
    40% {
        transform: scale(1.2);
        opacity: 1;
    }
}
</style>
