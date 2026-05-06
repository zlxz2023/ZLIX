<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import SettingsModal from '@renderer/components/SettingsModal.vue'
import SettingIcon from '@renderer/assets/icons/titlebar/setting.svg'
import MaxIcon from '@renderer/assets/icons/titlebar/maxium.svg'
import MinIcon from '@renderer/assets/icons/titlebar/minium.svg'
import MinimizeIcon from '@renderer/assets/icons/titlebar/minimize-window.svg'
import CloseIcon from '@renderer/assets/icons/close.svg'
import BackIcon from '@renderer/assets/icons/titlebar/back.svg'
import ForwardIcon from '@renderer/assets/icons/titlebar/forward.svg'

const router = useRouter()
const searchQuery = ref('')
const isFocused = ref(false)
const isMaximized = ref(false)
const isSettingsVisible = ref(false)

const api = (window as any).api

// 前进后退状态
const canGoBack = ref(false)
const canGoForward = ref(false)

// 更新前进后退状态
const updateNavigationState = () => {
  canGoBack.value = window.history.length > 1 && router.currentRoute.value.name !== 'home'
  canGoForward.value = false // Vue Router 不直接暴露 forward 栈
}

// 导航方法
const goBack = () => {
  if (canGoBack.value) {
    router.back()
  }
}

const goForward = () => {
  // Vue Router 的 forward 功能有限，这里使用 go(1)
  router.go(1)
}

// 拖拽状态
const dragState = ref({
  isDragging: false,
  startX: 0,
  startY: 0,
  startWinX: 0,
  startWinY: 0,
  winWidth: 0,
  winHeight: 0
})

// 缓存窗口 bounds
const cachedBounds = ref({
  x: 0,
  y: 0,
  width: 900,
  height: 670
})

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    router.push(`/main/search?keyword=${encodeURIComponent(searchQuery.value)}`)
  }
}

const minimize = () => {
  api?.ipcRenderer?.send('window-minimize')
}

const maximize = () => {
  api?.ipcRenderer?.send('window-maximize')
}

const close = () => {
  api?.ipcRenderer?.send('window-close')
}

const handleMaximizeChange = (_event: any, maximized: boolean) => {
  isMaximized.value = maximized
}

// 更新缓存 bounds
const updateCachedBounds = async () => {
  try {
    const api = (window as any).api
    if (api?.mainWindow?.getBounds) {
      const bounds = await api.mainWindow.getBounds()
      if (bounds) {
        cachedBounds.value.x = bounds.x
        cachedBounds.value.y = bounds.y
        cachedBounds.value.width = bounds.width
        cachedBounds.value.height = bounds.height
      }
    }
  } catch (e) {
    console.warn('获取主窗口 bounds 失败', e)
  }
}

// 拖拽开始
const handlePointerDown = (e: PointerEvent) => {
  if (isMaximized.value) return // 最大化时不可拖拽
  if (e.button !== 0) return // 只响应左键
  const target = e.target as HTMLElement
  // 过滤按钮、输入框等可交互元素
  if (
    target.closest('button') ||
    target.closest('input') ||
    target.closest('[contenteditable]')
  ) {
    return
  }
  dragState.value.isDragging = true
  dragState.value.startX = e.screenX
  dragState.value.startY = e.screenY
  dragState.value.startWinX = cachedBounds.value.x
  dragState.value.startWinY = cachedBounds.value.y
  dragState.value.winWidth = cachedBounds.value.width
  dragState.value.winHeight = cachedBounds.value.height
  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
  e.preventDefault()
}

// 拖拽移动（节流，16ms/次）
let lastMoveTime = 0
const handlePointerMove = (e: PointerEvent) => {
  if (!dragState.value.isDragging) return
  const now = Date.now()
  if (now - lastMoveTime < 16) return // 节流
  lastMoveTime = now
  const dx = e.screenX - dragState.value.startX
  const dy = e.screenY - dragState.value.startY
  const nx = Math.round(dragState.value.startWinX + dx)
  const ny = Math.round(dragState.value.startWinY + dy)
  const api = (window as any).api
  if (api?.mainWindow?.move) {
    api.mainWindow.move(nx, ny, dragState.value.winWidth, dragState.value.winHeight)
  }
}

// 拖拽结束
const handlePointerUp = () => {
  dragState.value.isDragging = false
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)
  updateCachedBounds() // 更新缓存 bounds
}

onMounted(async () => {
  api?.ipcRenderer?.on('window-maximized', handleMaximizeChange)

  // 监听从歌词窗口打开设置弹窗
  api?.ipcRenderer?.on('main-window:openSettings', () => {
    isSettingsVisible.value = true
  })

  await updateCachedBounds() // 初始化缓存 bounds

  // 监听鼠标事件
  document.addEventListener('pointerdown', handlePointerDown)

  // 更新导航状态
  updateNavigationState()
  // 监听路由变化
  router.afterEach(() => {
    updateNavigationState()
  })
})

onUnmounted(() => {
  api?.ipcRenderer?.removeListener('window-maximized', handleMaximizeChange)

  document.removeEventListener('pointerdown', handlePointerDown)

  if (dragState.value.isDragging) {
    handlePointerUp()
  }
})
</script>

<template>
  <header
    class="h-14 bg-secondary border-b border-theme flex items-center justify-between px-3"
    @pointerdown="handlePointerDown"
  >
    <!-- 左侧导航和搜索 -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <button
          @click="goBack"
          :disabled="!canGoBack"
          class="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-hover hover:scale-105 activate:scale-95 text-secondary cursor-pointer"
          :class="canGoBack ? 'hover:bg-hover text-secondary' : 'text-muted cursor-not-allowed'"
          title="后退"
        >
          <img :src="BackIcon" class="w-4 h-4" />
        </button>
        <button
          @click="goForward"
          class="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-hover hover:scale-105 activate:scale-95 text-secondary cursor-pointer"
          title="前进"
        >
          <img :src="ForwardIcon" class="w-4 h-4" />
        </button>
      </div>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted select-none">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="输入点什么吧"
          class="px-4 py-1.5 pl-10 bg-hover rounded-full text-sm text-primary placeholder-muted outline-none focus:ring-2 focus:ring-accent transition-all duration-300 w-64 focus:w-80"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keyup.enter="handleSearch"
        />
      </div>
    </div>

    <!-- 右侧按钮 -->
    <div class="flex items-center gap-5 select-none">
      <!-- 设置按钮 -->
      <button
        @click="isSettingsVisible = true"
        class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-hover
        transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        title="设置"
      >
        <img :src="SettingIcon" class="w-5 h-5" />
      </button>

      <!-- 窗口控制按钮 -->
      <button
        @click="minimize"
        class="w-7 h-7 flex items-center justify-center hover:bg-hover rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        title="最小化"
      >
        <img :src="MinimizeIcon" class="w-4 h-4" />
      </button>
      <button
        @click="maximize"
        class="w-7 h-7 flex items-center justify-center hover:bg-hover rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        :title="isMaximized ? '还原' : '最大化'"
      >
        <img :src="isMaximized ? MaxIcon : MinIcon" class="w-4 h-4" />
      </button>
      <button
        @click="close"
        class="w-8 h-8 flex items-center justify-center hover:bg-hover rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        title="关闭"
      >
        <span class="w-3 h-3 flex items-center justify-center">
            <img :src="CloseIcon" class="w-5 h-5" />
        </span>
      </button>
    </div>
  </header>

  <!-- 设置弹窗 -->
  <SettingsModal
    v-if="isSettingsVisible"
    :visible="isSettingsVisible"
    @close="isSettingsVisible = false"
  />
</template>
