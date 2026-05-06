<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore, PlayMode } from '@renderer/stores/player'
import { useLyricsStore } from '@renderer/stores/lyrics'
import { useSettingsStore } from '@renderer/stores/settings'
import PlaylistModal from '@renderer/components/PlaylistModal.vue'
import FullPlayerModal from '@renderer/components/FullPlayerModal.vue'
// 导入Icon
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import PauseIcon from '@renderer/assets/icons/player/pause.svg'
import NextIcon from '@renderer/assets/icons/player/next.svg'
import PreIcon from '@renderer/assets/icons/player/pre.svg'
import LoopIcon from '@renderer/assets/icons/player/playseq.svg'
import SingleIcon from '@renderer/assets/icons/player/playonlyone.svg'
import RandomIcon from '@renderer/assets/icons/player/randomplay.svg'
import NoVolIcon from '@renderer/assets/icons/player/no_vol.svg'
import LowVolIcon from '@renderer/assets/icons/player/low_vol.svg'
import MediumVolIcon from '@renderer/assets/icons/player/medium_vol.svg'
import MaxVolIcon from '@renderer/assets/icons/player/max_vol.svg'
import CollapseIcon from '@renderer/assets/icons/player/collapse.svg'
import CollapseDarkIcon from '@renderer/assets/icons/player/collapse-dark.svg'
import SonglistIcon from '@renderer/assets/icons/player/songlist.svg'
import LyricsOnIcon from '@renderer/assets/icons/player/lyrics.svg'
import LyricsCloseIcon from '@renderer/assets/icons/player/lyrics_close.svg'

const settingsStore = useSettingsStore()

// 判断当前是否是深色模式
const isDarkMode = computed(() => {
    if (settingsStore.theme === 'system') {
        // 跟随系统时判断系统是否是深色模式
        return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settingsStore.theme === 'dark'
})

// 获取收起按钮图标
const getCollapseIcon = computed(() => {
    return isDarkMode.value ? CollapseDarkIcon : CollapseIcon
})

// 获取歌词按钮图标（深色模式下逻辑相反）
const getLyricsIcon = computed(() => {
    const isVisible = playerStore.isLyricsWindowVisible
    if (isDarkMode.value) {
        // 深色模式下：可见显示On，不可见显示Close（与浅色相反）
        return isVisible ? LyricsCloseIcon : LyricsOnIcon
    }
    // 浅色模式下：可见显示Close，不可见显示On（原有逻辑）
    return isVisible ? LyricsOnIcon : LyricsCloseIcon
})

// 导入 toRaw 用于获取原始对象
import { toRaw } from 'vue'

const playerStore = usePlayerStore()
const lyricsStore = useLyricsStore()
const { LOOP, SINGLE, RANDOM } = PlayMode

const api = (window as any).api

// 设置弹窗是否可见
const isSettingsVisible = ref(false)

// 当前歌词文本
const currentLyricText = computed(() => {
  const lyrics = lyricsStore.currentLyrics
  if (!lyrics.length) return ''
  
  const currentTime = playerStore.currentTime
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (currentTime >= lyrics[i].time) {
      return lyrics[i].text
    }
  }
  return ''
})

// 全屏播放器引用
const fullPlayerModalRef = ref<InstanceType<typeof FullPlayerModal> | null>(null)

// 打开全屏播放器（播放队列为空时不允许打开）
const openFullPlayer = () => {
  if (!playerStore.currentTrack) {
    return
  }
  if (fullPlayerModalRef.value) {
    fullPlayerModalRef.value.open()
  }
}

const progress = computed(() => {
  if (playerStore.duration > 0) {
    return (playerStore.currentTime / playerStore.duration) * 100
  }
  return 0
})

const getPlayModeIcon = () => {
  switch (playerStore.playMode) {
    case LOOP:
      return LoopIcon
    case SINGLE:
      return SingleIcon
    case RANDOM:
      return RandomIcon
    default:
      return LoopIcon
  }
}

const getPlayModeTitle = () => {
  switch (playerStore.playMode) {
    case LOOP:
      return '列表循环'
    case SINGLE:
      return '单曲循环'
    case RANDOM:
      return '随机播放'
    default:
      return '列表循环'
  }
}

const getVolumeIcon = () => {
  // 如果是静音状态，显示静音图标
  if (playerStore.isMuted) return NoVolIcon
  const vol = playerStore.volume
  if (vol <= 40) return LowVolIcon
  if (vol <= 70) return MediumVolIcon
  return MaxVolIcon
}

const getPlaylistCount = computed(() => {
  const count = playerStore.playlist.length
  if (count === 0) return null
  if (count > 99) return '99+'
  return count.toString()
})

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleSeek = async (e: MouseEvent) => {
  if (playerStore.isCollapsed) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  await playerStore.seek(playerStore.duration * percent)
}

const toggleCollapse = () => {
  playerStore.toggleCollapse()
}

// 监听播放器状态变化并同步到歌词窗口
onMounted(() => {
  // 监听系统主题变化（仅在跟随系统模式下）
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    // 主题变化时，Vue的响应式系统会自动更新图标
  })
  
  // 监听 mpv 事件
  if (api?.mpv) {
    api.mpv.on('time-update', (time: number) => {
      playerStore.updateCurrentTime(time)
    })
    api.mpv.on('duration-change', (duration: number) => {
      playerStore.updateDuration(duration)
    })
    api.mpv.on('state-change', (state: any) => {
      playerStore.updatePlayingState(state === 'playing')
    })
    api.mpv.on('playback-end', () => {
      playerStore.playNextAuto()
    })
  }

  // 监听来自主进程的控制事件（歌词窗口触发）
  api?.ipcRenderer?.on('player:control', (_, action: string) => {
    switch (action) {
      case 'play':
      case 'pause':
      case 'toggle':
        playerStore.togglePlay()
        break
      case 'prev':
        playerStore.playPrev()
        break
      case 'next':
        playerStore.playNext()
        break
    }
  })

  // 监听歌词窗口可见性变化
    if (api?.lyricsWindow?.onVisibleChanged) {
        api.lyricsWindow.onVisibleChanged((visible: boolean) => {
            playerStore.setLyricsWindowVisible(visible)
        })
    }

  // 监听来自主进程的歌词窗口可见性变化事件
  api?.ipcRenderer?.on('lyrics-window:visibility-changed', (_, visible: boolean) => {
    playerStore.setLyricsWindowVisible(visible)
  })

  // 监听主进程发送的打开设置事件
  api?.ipcRenderer?.on('main-window:openSettings', () => {
    isSettingsVisible.value = true
  })

  // 监听歌词窗口请求数据事件
  api?.ipcRenderer?.on('lyrics-window:request-data', () => {
    // 歌词窗口请求数据，立即发送所有状态
    console.log('[PlayerBar] 歌词窗口请求数据，发送状态')
    playerStore.sendLyricsToWindow()
    // 同时也发送播放状态和时间
    if (api?.lyricsWindow) {
      api.lyricsWindow.sendPlayerState(playerStore.isPlaying)
      api.lyricsWindow.sendTimeUpdate(playerStore.currentTime)
    }
  })
  
  // 监听歌词窗口发送的播放上一首/下一首请求
  api?.ipcRenderer?.on('lyrics:playPrev', () => {
    console.log('[PlayerBar] 收到播放上一首请求')
    playerStore.playPrev()
  })
  
  api?.ipcRenderer?.on('lyrics:playNext', () => {
    console.log('[PlayerBar] 收到播放下一首请求')
    playerStore.playNext()
  })
})

// 监听播放器 store 变化并同步
watch(
  () => playerStore.currentTime,
  (time) => {
    if (api?.lyricsWindow) {
      api.lyricsWindow.sendTimeUpdate(time)
    }
  }
)

watch(
  () => playerStore.duration,
  (duration) => {
    if (api?.lyricsWindow) {
      api.lyricsWindow.sendDurationUpdate(duration)
    }
  }
)

watch(
  () => playerStore.isPlaying,
  (state) => {
    if (api?.lyricsWindow) {
      api.lyricsWindow.sendPlayerState(state)
    }
  }
)

// 监听歌词变化并同步到歌词窗口
watch(
  () => lyricsStore.currentLyrics,
  (lyrics) => {
    // 使用 toRaw 将响应式对象转换为普通对象，避免 IPC 克隆失败
    const plainLyrics = JSON.parse(JSON.stringify(toRaw(lyrics)))
    console.log(`[PlayerBar] 📤 同步歌词 ${plainLyrics.length} 行`)
    if (api?.lyricsWindow) {
      const currentTrack = playerStore.currentTrack
      api.lyricsWindow.sendLyricsUpdate({
        songName: currentTrack?.name || '',
        artistName: currentTrack?.artists?.map((a: any) => a.name).join(' ') || '',
        currentTime: playerStore.currentTime,
        lyrics: plainLyrics
      })
    }
  },
  { deep: true }
)

// 监听当前歌曲变化并同步歌词
watch(
  () => playerStore.currentTrack,
  (track) => {
    // 使用 toRaw 将响应式对象转换为普通对象
    const plainTrack = track ? JSON.parse(JSON.stringify(toRaw(track))) : null
    if (api?.lyricsWindow && plainTrack) {
      // 发送当前歌曲信息到歌词窗口
      api.lyricsWindow.sendLyricsUpdate({
        songId: plainTrack.id,
        songName: plainTrack.name,
        artistName: plainTrack.artists?.map((a: any) => a.name).join(' ') || '',
        currentTime: playerStore.currentTime,
        isPlaying: playerStore.isPlaying,
        lyrics: JSON.parse(JSON.stringify(toRaw(lyricsStore.currentLyrics)))
      })
    }
  }
)

onUnmounted(() => {
  // 清理监听器
})
</script>

<template>
  <PlaylistModal />
  <FullPlayerModal ref="fullPlayerModalRef" />

  <!-- 收起时的小圆球（只有有歌曲时才显示） -->
  <Transition name="collapsed">
    <div
      v-if="playerStore.isCollapsed && playerStore.currentTrack"
      class="fixed bottom-4 right-4 w-16 h-16 bg-card rounded-full flex items-center justify-center cursor-pointer z-50 shadow-lg hover:bg-hover transition-colors border border-theme"
      @click="toggleCollapse"
    >
      <img
        v-if="playerStore.currentTrack?.album.picUrl"
        :src="playerStore.currentTrack.album.picUrl"
        class="w-14 h-14 rounded-full object-cover hover:opacity-80 transition-opacity pointer-events-none"
      />
      <span
        v-else
        class="text-white text-2xl hover:opacity-80 transition-opacity pointer-events-none"
      >🎵</span>
      <!-- 播放状态指示器 -->
      <div
        v-if="playerStore.isPlaying"
        class="absolute -bottom-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center"
      >
        <span class="text-white text-xs">▶</span>
      </div>
    </div>
  </Transition>

  <!-- 展开的完整PlayerBar -->
  <Transition name="expanded">
    <footer
      v-if="!playerStore.isCollapsed"
      class="fixed bottom-0 left-0 right-0 h-20 bg-secondary border-t border-theme flex flex-col z-50 shadow-lg select-none"
    >
    <!-- 进度条 -->
    <div
      class="absolute top-0 left-0 right-0 h-1 bg-active cursor-pointer group"
      @click="handleSeek"
    >
      <div
        class="absolute top-0 left-0 h-1 bg-accent transition-all duration-100"
        :style="{ width: `${progress}%` }"
      ></div>
      <div
        class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        :style="{ left: `calc(${progress}% - 8px)` }"
      ></div>
    </div>

    <div class="flex-1 flex items-center px-4 gap-4">
      <!-- 左侧：歌曲信息 -->
      <div class="flex items-center gap-3 flex-shrink-0 w-64">
        <div
          class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          v-if="!playerStore.currentTrack?.album.picUrl"
          @click="openFullPlayer"
        >
          <span class="text-white text-xl">🎵</span>
        </div>
        <img
          v-else
          :src="playerStore.currentTrack?.album.picUrl"
          class="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity shadow-md flex-shrink-0"
          @click="openFullPlayer"
        />
        <div class="flex-1 min-w-0">
          <p class="text-primary text-sm font-bold truncate">
            {{ playerStore.currentTrack?.name || '暂无歌曲' }}
          </p>
          <p 
            class="text-xs truncate"
            :class="currentLyricText ? 'text-pink-500' : 'text-secondary'"
          >
            {{ currentLyricText || (playerStore.currentTrack?.artists?.map((a) => a.name).join(' / ') || '未知歌手') }}
          </p>
        </div>
      </div>

      <!-- 中间：控制按钮 -->
      <div class="flex-1 flex items-center justify-center gap-2">
        <!-- 上一首 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary 
          hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
          @click="playerStore.playPrev()"
          title="上一首"
        >
          <img :src="PreIcon" class="w-4 h-4" />
        </button>

        <!-- 播放/暂停 -->
        <button
          class="w-10 h-10 flex items-center justify-center bg-hover rounded-full hover:bg-active transition-all duration-200 text-primary cursor-pointer hover:scale-110 active:scale-95"
          @click="playerStore.togglePlay()"
        >
          <img v-if="playerStore.isPlaying" :src="PauseIcon" class="w-4 h-4" />
          <img v-else :src="PlayIcon" class="w-4 h-4 transform translate-x-0.5" />
        </button>

        <!-- 下一首 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
          :disabled="!playerStore.hasNext"
          @click="playerStore.playNext()"
          title="下一首"
        >
          <img :src="NextIcon" class="w-4 h-4" />
        </button>
      </div>

      <!-- 右侧：时间和功能按钮 -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <span class="text-secondary text-xs"
          >{{ formatTime(playerStore.currentTime) }}/{{
            formatTime(playerStore.duration)
          }}</span
        >
        <!-- 播放模式 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
          @click="playerStore.togglePlayMode()"
          :title="getPlayModeTitle()"
        >
          <img :src="getPlayModeIcon()" class="w-5 h-5" />
        </button>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
          @click="playerStore.toggleLyricsWindow"
          title="歌词"
        >
          <img 
            :src="getLyricsIcon" 
            class="w-5 h-5" 
          />
        </button>

        <!-- 音量 -->
        <div class="relative group">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
            @click="playerStore.toggleMute"
            title="音量"
          >
            <img :src="getVolumeIcon()" class="w-5 h-5" />
          </button>
          <!-- 悬浮音量条 -->
          <div
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-14 h-44 bg-secondary rounded-lg shadow-lg border border-theme opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-auto"
          >
            <div class="relative w-full h-full flex flex-col items-center py-3">
              <!-- 音量条背景 -->
              <div class="w-2 h-32 bg-active rounded-full relative overflow-hidden">
                <!-- 音量条填充（从底部往上） -->
                <div
                  class="absolute bottom-0 left-0 w-full bg-accent rounded-full transition-all duration-100"
                  :style="{ height: `${playerStore.isMuted ? 0 : playerStore.volume}%` }"
                ></div>
                <!-- 可拖动滑块（覆盖整个音量条区域） -->
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="playerStore.isMuted ? 0 : playerStore.volume"
                  @input="(e) => playerStore.setVolume((e.target as HTMLInputElement).valueAsNumber)"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style="writing-mode: vertical-lr;"
                />
              </div>
              <!-- 音量百分比（在下方） -->
              <span class="text-xs text-secondary mt-3">{{ playerStore.isMuted ? 0 : playerStore.volume }}%</span>
            </div>
          </div>
        </div>

        <!-- 收起按钮 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
          @click="toggleCollapse"
          title="收起"
        >
          <img :src="getCollapseIcon" class="w-7 h-7" />
        </button>

        <!-- 播放列表 -->
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full text-secondary hover:text-primary transition-all duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer relative"
          :class="{ 'text-pink-500': playerStore.showPlaylist }"
          title="播放列表"
          @click="playerStore.togglePlaylist()"
        >
          <img :src="SonglistIcon" class="w-6 h-6" />
          <span
            v-if="getPlaylistCount"
            class="absolute -top-0 -right-0 min-w-3 h-3 px-0.5 bg-active text-primary text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
          >
            {{ getPlaylistCount }}
          </span>
        </button>
      </div>
    </div>
  </footer>
  </Transition>
</template>

<style scoped>
/* 收起状态的小圆球动画 */
.collapsed-enter-active,
.collapsed-leave-active {
  transition: all 0.3s ease-out;
}

.collapsed-enter-from,
.collapsed-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

.collapsed-enter-to,
.collapsed-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* 展开状态的 PlayBar 动画 */
.expanded-enter-active,
.expanded-leave-active {
  transition: all 0.3s ease-out;
}

.expanded-enter-from,
.expanded-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.expanded-enter-to,
.expanded-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
