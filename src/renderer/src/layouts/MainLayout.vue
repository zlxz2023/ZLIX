<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import TitleBar from './TitleBar.vue'
import PlayerBar from './PlayerBar.vue'
import { RouterView } from 'vue-router'
import { onMounted, onUnmounted, ref } from 'vue'
import { usePlayerStore, PlayMode } from '@renderer/stores/player'
import BacktoupIcon from '@renderer/assets/icons/backtoup.svg'

const playerStore = usePlayerStore()

// 返回顶部相关
const showBackToTop = ref(false)
const scrollContainer = ref<HTMLElement>()

const handleScroll = () => {
  if (scrollContainer.value) {
    showBackToTop.value = scrollContainer.value.scrollTop > 300
  }
}

const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }
}

// 防止 playback-end 重复触发
let lastPlaybackEndTime = 0
const PLAYBACK_END_DEBOUNCE = 500

const handleTimeUpdate = (time: number) => {
  playerStore.updateCurrentTime(time)
}

const handleDurationChange = (duration: number) => {
  playerStore.updateDuration(duration)
}

const handleStateChange = (state: any) => {
  playerStore.updatePlayingState(state?.playing || false)
}

const handlePlaybackEnd = () => {
  // 防抖：500ms 内只处理一次
  const now = Date.now()
  if (now - lastPlaybackEndTime < PLAYBACK_END_DEBOUNCE) {
    console.log('[MainLayout] ⏳ playback-end 防抖，忽略')
    return
  }
  lastPlaybackEndTime = now

  console.log('[MainLayout] 🎵 播放结束，自动下一首')
  playerStore.playNextAuto()
}

onMounted(async () => {
  const { mpv } = (window as any).api

  mpv.on('time-update', handleTimeUpdate)
  mpv.on('duration-change', handleDurationChange)
  mpv.on('state-change', handleStateChange)
  mpv.on('playback-end', handlePlaybackEnd)

  // 验证并修复播放模式
  const validModes = [PlayMode.LOOP, PlayMode.SINGLE, PlayMode.RANDOM]
  if (!validModes.includes(playerStore.playMode)) {
    console.warn('[MainLayout] 从 localStorage 恢复了无效的 playMode:', playerStore.playMode, ', 重置为列表循环')
    playerStore.playMode = PlayMode.LOOP
  }

  // 调用播放器初始化（预加载当前歌曲URL和歌词）
  await playerStore.initializePlayer()

  try {
    const state = await mpv.getState()
    if (state) {
      playerStore.updatePlayingState(state.playing || false)
      playerStore.updateDuration(state.duration || 0)
      playerStore.setVolume(state.volume || 100)
    }
  } catch (error) {
    console.error('获取初始状态失败:', error)
  }
})

onUnmounted(() => {
  const { mpv } = (window as any).api
  mpv.off('time-update', handleTimeUpdate)
  mpv.off('duration-change', handleDurationChange)
  mpv.off('state-change', handleStateChange)
  mpv.off('playback-end', handlePlaybackEnd)
})
</script>

<template>
  <div class="main-layout">
    <Sidebar />
    <div class="main-content">
      <TitleBar />
      <main ref="scrollContainer" @scroll="handleScroll">
        <div class="pb-24">
          <RouterView />
        </div>
        
        <!-- 返回顶部按钮 -->
        <Transition name="fade">
          <button
            v-if="showBackToTop"
            class="fixed bottom-28 right-8 w-12 h-12 bg-hover rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-active transition-all z-40"
            @click="scrollToTop"
            title="返回顶部"
          >
            <span class="text-lg">
                <img :src="BacktoupIcon" class="w-5 h-5" />
            </span>
          </button>
        </Transition>
      </main>
      <PlayerBar />
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-secondary);
}

main {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  margin: 0;
  position: relative;
  background: var(--color-bg-secondary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
