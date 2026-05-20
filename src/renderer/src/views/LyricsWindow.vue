<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useLyricsStore } from '@renderer/stores/lyrics'
import { useSettingsStore } from '@renderer/stores/settings'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import PauseIcon from '@renderer/assets/icons/player/pause.svg'
import NextIcon from '@renderer/assets/icons/player/next.svg'
import PreIcon from '@renderer/assets/icons/player/pre.svg'
import SettingIcon from '@renderer/assets/icons/titlebar/setting.svg'
import CloseIcon from '@renderer/assets/icons/close.svg'
import LockIcon from '@renderer/assets/icons/desktoplyrics/lock.svg'
import UnlockIcon from '@renderer/assets/icons/desktoplyrics/unlock.svg'

const lyricsStore = useLyricsStore()
const settingsStore = useSettingsStore()

const currentTime = ref(0)
const isMouseOver = ref(false)
const isPlaying = ref(false)
const isLocked = ref(false)

const localSongInfo = ref({
    songName: '',
    artistName: ''
})

const hasSong = computed(() => {
    return localSongInfo.value.songName !== ''
})

const dragState = ref({
    isDragging: false,
    startX: 0,
    startY: 0,
    startWinX: 0,
    startWinY: 0,
    winWidth: 0,
    winHeight: 0
})

const cachedBounds = ref({
    x: 0,
    y: 0,
    width: 600,
    height: 150
})

const currentIndex = computed(() => {
    if (!lyricsStore.currentLyrics.length) return -1
    for (let i = lyricsStore.currentLyrics.length - 1; i >= 0; i--) {
        if (currentTime.value >= lyricsStore.currentLyrics[i].time) {
            return i
        }
    }
    return -1
})

const currentSongInfo = computed(() => {
    if (localSongInfo.value.songName) {
        return `${localSongInfo.value.songName} - ${localSongInfo.value.artistName}`
    }
    return ''
})

const visibleLyrics = computed(() => {
    const idx = currentIndex.value
    if (idx < 0) return { current: null, next: null }

    return {
        current: lyricsStore.currentLyrics[idx] || null,
        next: lyricsStore.currentLyrics[idx + 1] || null
    }
})

const api = (window as any).api

const handlePointerDown = (e: PointerEvent) => {
    if (isLocked.value) return
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.control-btn') || target.closest('.unlock-btn')) return
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

let lastMoveTime = 0
const handlePointerMove = (e: PointerEvent) => {
    if (!dragState.value.isDragging) return
    const now = Date.now()
    if (now - lastMoveTime < 16) return
    lastMoveTime = now
    const dx = e.screenX - dragState.value.startX
    const dy = e.screenY - dragState.value.startY
    const nx = Math.round(dragState.value.startWinX + dx)
    const ny = Math.round(dragState.value.startWinY + dy)
    if (api?.lyricsWindow?.move) {
        api.lyricsWindow.move(nx, ny, dragState.value.winWidth, dragState.value.winHeight)
    }
}

const handlePointerUp = () => {
    dragState.value.isDragging = false
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    updateCachedBounds()
}

const handleMouseEnter = () => {
    isMouseOver.value = true
}

const handleMouseLeave = () => {
    isMouseOver.value = false
}

const togglePlay = async () => {
    if (isLocked.value) return
    try {
        if (isPlaying.value) {
            await api.mpv.pause()
            isPlaying.value = false
        } else {
            await api.mpv.play()
            isPlaying.value = true
        }
    } catch (error) {
        console.error('[LyricsWindow] 播放/暂停失败:', error)
    }
}

const playPrev = () => {
    if (isLocked.value) return
    api.ipcRenderer.send('lyrics:playPrev')
}

const playNext = () => {
    if (isLocked.value) return
    api.ipcRenderer.send('lyrics:playNext')
}

const toggleLock = () => {
    const newLockedState = !isLocked.value
    isLocked.value = newLockedState
    if (api?.lyricsWindow?.setIgnoreMouseEvents) {
        if (newLockedState) {
            api.lyricsWindow.setIgnoreMouseEvents(true, true)
        } else {
            api.lyricsWindow.setIgnoreMouseEvents(false)
        }
    }
}

const handleUnlockBtnEnter = () => {
    if (api?.lyricsWindow?.setIgnoreMouseEvents && isLocked.value) {
        api.lyricsWindow.setIgnoreMouseEvents(false)
    }
}

const handleUnlockBtnLeave = () => {
    if (api?.lyricsWindow?.setIgnoreMouseEvents && isLocked.value) {
        api.lyricsWindow.setIgnoreMouseEvents(true, true)
    }
}

const openSettings = () => {
    if (api?.mainWindow) {
        api.mainWindow.openSettings()
        api.mainWindow.focus()
    }
}

const closeWindow = () => {
    if (isLocked.value) return
    if (api?.lyricsWindow?.hide) {
        api.lyricsWindow.hide()
        api?.ipcRenderer?.send('lyrics-window:visibility-changed', false)
    }
}

const updateCachedBounds = async () => {
    try {
        if (api?.lyricsWindow?.getBounds) {
            const bounds = await api.lyricsWindow.getBounds()
            if (bounds) {
                cachedBounds.value.x = bounds.x
                cachedBounds.value.y = bounds.y
                cachedBounds.value.width = bounds.width
                cachedBounds.value.height = bounds.height
            }
        }
    } catch (e) {
        console.warn('获取歌词窗口 bounds 失败:', e)
    }
}

onMounted(async () => {
    await updateCachedBounds()

    // 直接监听 mpv 事件
    if (api?.mpv?.on) {
        api.mpv.on('time-update', (time: number) => {
            currentTime.value = time
        })

        api.mpv.on('state-change', (state: any) => {
            if (typeof state === 'boolean') {
                isPlaying.value = state
            }
        })
    }

    // 监听歌词更新
    if (api?.lyricsWindow?.onLyricsUpdate) {
        api.lyricsWindow.onLyricsUpdate((data: any) => {
            if (data) {
                if (data.songName) {
                    localSongInfo.value.songName = data.songName
                    localSongInfo.value.artistName = data.artistName || ''
                }
                if (data.lyrics && Array.isArray(data.lyrics)) {
                    console.log('[LyricsWindow] 📥 收到歌词:', data.lyrics.length)
                    lyricsStore.currentLyrics = data.lyrics
                }
                if (typeof data.currentTime === 'number') {
                    currentTime.value = data.currentTime
                }
                if (typeof data.isPlaying === 'boolean') {
                    isPlaying.value = data.isPlaying
                }
            }
        })
    }

    if (api?.lyricsWindow?.onSettingsUpdate) {
        api.lyricsWindow.onSettingsUpdate((settings: any) => {
            console.log('[LyricsWindow] 📥 收到设置更新:', settings)
            if (settings.lyricsCurrentColor) {
                settingsStore.lyricsCurrentColor = settings.lyricsCurrentColor
            }
            if (settings.lyricsNextColor) {
                settingsStore.lyricsNextColor = settings.lyricsNextColor
            }
            if (settings.lyricsSongInfoColor) {
                settingsStore.lyricsSongInfoColor = settings.lyricsSongInfoColor
            }
            if (settings.lyricsFontSize) {
                settingsStore.lyricsFontSize = settings.lyricsFontSize
            }
            if (settings.lyricsNextFontSize) {
                settingsStore.lyricsNextFontSize = settings.lyricsNextFontSize
            }
        })
    }

    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('pointerdown', handlePointerDown)

    if (api?.lyricsWindow?.requestData) {
        console.log('[LyricsWindow] 📡 向主窗口请求歌词数据')
        api.lyricsWindow.requestData()
    }
})

onUnmounted(() => {
    document.removeEventListener('mouseenter', handleMouseEnter)
    document.removeEventListener('mouseleave', handleMouseLeave)
    document.removeEventListener('pointerdown', handlePointerDown)
    if (dragState.value.isDragging) {
        handlePointerUp()
    }
})
</script>

<template>
    <div class="lyrics-window" @mouseenter="isMouseOver = true" @mouseleave="isMouseOver = false">
        <div
            v-if="isLocked"
            class="locked-state"
            @mouseenter="isMouseOver = true"
            @mouseleave="isMouseOver = false"
        >
            <div class="header locked-header" :class="{ show: isMouseOver }">
                <div class="left-section"></div>
                <div class="controls" style="visibility: hidden">
                    <div style="width: 80px"></div>
                </div>
                <div class="right-section">
                    <button
                        class="control-btn unlock-only-btn"
                        @click="toggleLock"
                        @mouseenter="handleUnlockBtnEnter"
                        @mouseleave="handleUnlockBtnLeave"
                        title="解锁窗口"
                    >
                        <img :src="UnlockIcon" class="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div class="lyrics-container locked">
                <div class="lyrics-display">
                    <div v-if="!hasSong" class="lyric-empty-message">播放队列暂无歌曲~</div>
                    <template v-else>
                        <div
                            v-if="visibleLyrics.next"
                            class="lyric-next"
                            :style="{
                                color: settingsStore.lyricsNextColor,
                                fontSize: settingsStore.lyricsNextFontSize + 'px'
                            }"
                        >
                            {{ visibleLyrics.next.text }}
                        </div>
                        <div
                            v-if="visibleLyrics.current"
                            class="lyric-current"
                            :style="{
                                color: settingsStore.lyricsCurrentColor,
                                fontSize: settingsStore.lyricsFontSize + 'px'
                            }"
                        >
                            {{ visibleLyrics.current.text }}
                        </div>
                        <div
                            v-if="!visibleLyrics.current && !visibleLyrics.next"
                            class="lyric-song-info"
                        >
                            {{ currentSongInfo }}
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <div v-else class="unlocked-state">
            <div class="bg-layer" :class="isMouseOver ? 'show' : ''"></div>

            <div class="header" :class="isMouseOver ? 'show' : ''">
                <div class="left-section">
                    <span class="song-name">
                        {{ localSongInfo.songName || '暂无歌曲' }}
                    </span>
                    <span v-if="localSongInfo.artistName" class="artist">
                        - {{ localSongInfo.artistName }}
                    </span>
                </div>

                <div class="controls">
                    <button class="control-btn" @click="playPrev" title="上一首">
                        <img :src="PreIcon" class="w-4 h-4" />
                    </button>
                    <button
                        class="control-btn play-btn"
                        @click="togglePlay"
                        :title="isPlaying ? '暂停' : '播放'"
                    >
                        <img v-if="isPlaying" :src="PauseIcon" class="w-4 h-4" />
                        <img v-else :src="PlayIcon" class="w-4 h-4" />
                    </button>
                    <button class="control-btn" @click="playNext" title="下一首">
                        <img :src="NextIcon" class="w-4 h-4" />
                    </button>
                </div>

                <div class="right-section">
                    <button class="control-btn" @click="toggleLock" title="锁定窗口">
                        <img :src="LockIcon" class="w-5 h-5" />
                    </button>
                    <button class="control-btn" @click="openSettings" title="设置">
                        <img :src="SettingIcon" class="w-5 h-5" />
                    </button>
                    <button class="control-btn close-btn" @click="closeWindow" title="关闭">
                        <img :src="CloseIcon" class="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div class="lyrics-container">
                <div class="lyrics-display">
                    <div v-if="!hasSong" class="lyric-empty-message">播放队列暂无歌曲~</div>
                    <template v-else>
                        <div
                            v-if="visibleLyrics.next"
                            class="lyric-next"
                            :style="{
                                color: settingsStore.lyricsNextColor,
                                fontSize: settingsStore.lyricsNextFontSize + 'px'
                            }"
                        >
                            {{ visibleLyrics.next.text }}
                        </div>
                        <div
                            v-if="visibleLyrics.current"
                            class="lyric-current"
                            :style="{
                                color: settingsStore.lyricsCurrentColor,
                                fontSize: settingsStore.lyricsFontSize + 'px'
                            }"
                        >
                            {{ visibleLyrics.current.text }}
                        </div>
                        <div
                            v-if="!visibleLyrics.current && !visibleLyrics.next"
                            class="lyric-song-info"
                            :style="{ color: settingsStore.lyricsSongInfoColor }"
                        >
                            {{ currentSongInfo }}
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
html,
body {
    background-color: transparent !important;
    margin: 0;
    padding: 0;
    height: 100%;
}
</style>

<style scoped>
.lyrics-window {
    width: 100%;
    height: 100%;
    position: relative;
    color: #fff;
    background-color: transparent;
    user-select: none;
    cursor: default;
    overflow: hidden;
    border-radius: 12px;
}

.locked-state {
    width: 100%;
    height: 100%;
    position: relative;
}

.unlock-only-btn {
    background-color: rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(10px);
}

.unlocked-state {
    width: 100%;
    height: 100%;
    position: relative;
}

.bg-layer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.bg-layer.show {
    opacity: 1;
}

.header {
    position: relative;
    z-index: 10;
    width: 100%;
    height: 36px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.locked-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.locked-header.show {
    opacity: 1;
}

.header.show {
    opacity: 1;
}

.left-section {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 180px;
    flex-shrink: 0;
    overflow: hidden;
}

.song-name {
    font-size: 13px;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 1;
}

.artist {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}

.controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    margin-left: 9%;
}

.right-section {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100px;
    flex-shrink: 0;
    justify-content: flex-end;
}

.control-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.15s;
    border: none;
    outline: none;
    padding: 0;
}

.control-btn:hover {
    background-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
}

.control-btn:active {
    transform: scale(0.95);
}

.control-btn.play-btn {
    width: 36px;
    background-color: rgba(255, 255, 255, 0.18);
}

.control-btn.close-btn:hover {
    background-color: rgba(239, 68, 68, 0.9);
}

.lyrics-container {
    position: relative;
    z-index: 1;
    width: 100%;
    height: calc(100% - 36px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    cursor: move;
}

.lyrics-container.locked {
    height: 100%;
    cursor: default;
}

.lyrics-display {
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 8px;
}

.lyric-current {
    font-size: 32px;
    font-weight: 600;
    color: #ff3355;
    text-shadow: 0 2px 12px rgba(255, 51, 85, 0.5);
    animation: pulse 1s ease-in-out infinite;
}

.lyric-next {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.4);
    filter: blur(1px);
}

.lyric-song-info {
    font-size: 24px;
    color: #ff3355;
}

.lyric-empty {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.4);
}

.lyric-empty-message {
    font-size: 20px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    padding: 20px;
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.85;
    }
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
