<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { usePlayerStore, PlayMode } from '@renderer/stores/player'
import { useLyricsStore } from '@renderer/stores/lyrics'
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
import PulldownIcon from '@renderer/assets/icons/pulldown.svg'
import SonglistIcon from '@renderer/assets/icons/player/songlist.svg'
import LyricsOnIcon from '@renderer/assets/icons/player/lyrics.svg'
import LyricsCloseIcon from '@renderer/assets/icons/player/lyrics_close.svg'
import DeleteIcon from '@renderer/assets/icons/playlistmodal/delete-dark.svg'
import LocationIcon from '@renderer/assets/icons/playlistmodal/location.svg'

const playerStore = usePlayerStore()
const lyricsStore = useLyricsStore()
const { LOOP, SINGLE, RANDOM } = PlayMode

const isVisible = ref(false)
const isMouseOver = ref(false)
const showPlaylist = ref(false)
const playlistScrollContainer = ref<HTMLElement | null>(null)
const showVolumePanel = ref(false)
const lyricsContainer = ref<HTMLElement | null>(null)
let volumeHideTimer: any = null

const handleVolumeMouseEnter = () => {
    if (volumeHideTimer) {
        clearTimeout(volumeHideTimer)
        volumeHideTimer = null
    }
    showVolumePanel.value = true
}

const handleVolumeMouseLeave = () => {
    volumeHideTimer = setTimeout(() => {
        showVolumePanel.value = false
    }, 300)
}

const handleLyricClick = async (time: number) => {
    await playerStore.seek(time)
}

const scrollToCurrentLyric = () => {
    const container = lyricsContainer.value
    if (!container) return

    const currentElement = container.querySelector('.lyric-current')
    if (currentElement) {
        const containerRect = container.getBoundingClientRect()
        const elementRect = currentElement.getBoundingClientRect()
        const scrollTop =
            container.scrollTop +
            (elementRect.top - containerRect.top) -
            containerRect.height / 2 +
            elementRect.height / 2
        container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
        })
    }
}

const progress = computed(() => {
    if (playerStore.duration > 0) {
        return (playerStore.currentTime / playerStore.duration) * 100
    }
    return 0
})

const currentTime = computed(() => playerStore.currentTime)

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
    const track = playerStore.currentTrack
    if (track) {
        return `${track.name} - ${track.artists?.map((a: any) => a.name).join(' ')}`
    }
    return ''
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

const getVolumeIcon = () => {
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

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleSeek = async (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    await playerStore.seek(playerStore.duration * percent)
}

const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlaylistPlay = async (index: number) => {
    await playerStore.playByIndex(index)
}

const handlePlaylistRemove = (index: number, event: Event) => {
    event.stopPropagation()
    playerStore.removeFromQueue(index)
}

const handlePlaylistClear = () => {
    playerStore.clearQueue()
}

const handlePlaylistPlayCurrent = () => {
    if (playerStore.currentIndex >= 0) {
        nextTick(() => {
            const container = playlistScrollContainer.value
            if (!container) return

            const currentElement = container.querySelector(
                `[data-index="${playerStore.currentIndex}"]`
            )
            if (currentElement) {
                currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        })
    }
}

const closeModal = () => {
    isVisible.value = false
}

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
        if (showPlaylist.value) {
            showPlaylist.value = false
        } else {
            closeModal()
        }
    }
}

watch(currentIndex, () => {
    scrollToCurrentLyric()
})

onMounted(() => {
    document.addEventListener('keydown', handleKeydown)

    // 监听来自主进程的歌词窗口可见性变化事件
    window.api?.ipcRenderer?.on('lyrics-window:visibility-changed', (_, visible: boolean) => {
        playerStore.setLyricsWindowVisible(visible)
    })
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
})

defineExpose({
    open: () => {
        isVisible.value = true
    },
    close: closeModal
})
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div
                v-if="isVisible"
                class="full-player-overlay"
                @mouseenter="isMouseOver = true"
                @mouseleave="isMouseOver = false"
                @click.self="closeModal"
            >
                <div class="full-player-content">
                    <!-- 右上角关闭按钮（悬停显示） -->
                    <Transition name="fade">
                        <button
                            v-show="isMouseOver"
                            class="top-btn"
                            title="收起"
                            @click="closeModal"
                        >
                            <img :src="PulldownIcon" class="w-4 h-4" />
                        </button>
                    </Transition>

                    <div class="player-main">
                        <!-- 左侧：封面 -->
                        <div class="album-cover">
                            <img
                                v-if="playerStore.currentTrack?.album.picUrl"
                                :src="playerStore.currentTrack.album.picUrl"
                                class="cover-image"
                            />
                            <div v-else class="cover-placeholder">🎵</div>
                            <div class="song-info">
                                <h2 class="song-name">
                                    {{ playerStore.currentTrack?.name || '暂无歌曲' }}
                                </h2>
                                <p class="song-subtitle">
                                    {{ playerStore.currentTrack?.album?.name || '' }}
                                </p>
                                <div class="song-tags">
                                    <span
                                        v-if="playerStore.currentTrack?.quality === 'hq'"
                                        class="tag"
                                        >HQ</span
                                    >
                                    <span v-if="lyricsStore.currentLyrics.length" class="tag"
                                        >LRC</span
                                    >
                                    <span
                                        class="tag"
                                        >{{ playerStore.currentTrack?.artists?.map((a: any) => a.name).join(' ') || '' }}</span
                                    >
                                </div>
                                <p class="song-album">
                                    {{ playerStore.currentTrack?.album?.name || '' }} ·
                                    {{ playerStore.currentTrack?.artists?.map((a: any) => a.name).join(' ') || '' }}
                                </p>
                            </div>
                        </div>

                        <!-- 右侧：歌词 -->
                        <div class="lyrics-area">
                            <div ref="lyricsContainer" class="lyrics-container">
                                <div
                                    v-if="lyricsStore.currentLyrics.length === 0"
                                    class="lyrics-empty"
                                >
                                    {{ currentSongInfo }}
                                </div>
                                <div v-else class="lyrics-scroll">
                                    <div
                                        v-for="(lyric, index) in lyricsStore.currentLyrics"
                                        :key="index"
                                        class="lyric-item"
                                        :class="{ 'lyric-current': index === currentIndex }"
                                        @click="handleLyricClick(lyric.time)"
                                    >
                                        {{ lyric.text }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 底部控制栏（悬停显示） -->
                    <Transition name="slide-up">
                        <div v-show="isMouseOver" class="bottom-controls">
                            <!-- 第一行：控制按钮 -->
                            <div class="bottom-controls-row">
                                <!-- 左侧占位 -->
                                <div class="bottom-left"></div>

                                <!-- 中间控制 -->
                                <div class="bottom-center">
                                    <!-- 上一首 -->
                                    <button
                                        class="ctrl-btn"
                                        :class="{ disabled: !playerStore.hasPrev }"
                                        :disabled="!playerStore.hasPrev"
                                        @click="playerStore.playPrev()"
                                        title="上一首"
                                    >
                                        <img :src="PreIcon" class="w-4 h-4" />
                                    </button>

                                    <!-- 播放/暂停 -->
                                    <button class="play-btn" @click="playerStore.togglePlay()">
                                        <img
                                            v-if="playerStore.isPlaying"
                                            :src="PauseIcon"
                                            class="w-6 h-6"
                                        />
                                        <img
                                            v-else
                                            :src="PlayIcon"
                                            class="w-6 h-6 transform translate-x-0.5"
                                        />
                                    </button>

                                    <!-- 下一首 -->
                                    <button
                                        class="ctrl-btn"
                                        :class="{ disabled: !playerStore.hasNext }"
                                        :disabled="!playerStore.hasNext"
                                        @click="playerStore.playNext()"
                                        title="下一首"
                                    >
                                        <img :src="NextIcon" class="w-4 h-4" />
                                    </button>
                                </div>

                                <!-- 右侧按钮 -->
                                <div class="bottom-right">
                                    <!-- 播放模式 -->
                                    <button
                                        class="ctrl-btn"
                                        :title="getPlayModeTitle()"
                                        @click="playerStore.togglePlayMode()"
                                    >
                                        <img :src="getPlayModeIcon()" class="w-5 h-5" />
                                    </button>

                                    <!-- 歌词 -->
                                    <button
                                        class="ctrl-btn"
                                        :class="{
                                            'ctrl-btn-active': playerStore.isLyricsWindowVisible
                                        }"
                                        title="歌词"
                                        @click="playerStore.toggleLyricsWindow"
                                    >
                                        <img
                                            :src="
                                                playerStore.isLyricsWindowVisible
                                                    ? LyricsCloseIcon
                                                    : LyricsOnIcon
                                            "
                                            class="w-5 h-5"
                                        />
                                    </button>

                                    <!-- 音量 -->
                                    <div
                                        class="volume-btn-group"
                                        @mouseenter="handleVolumeMouseEnter"
                                        @mouseleave="handleVolumeMouseLeave"
                                    >
                                        <button
                                            class="ctrl-btn"
                                            title="音量"
                                            @click="playerStore.toggleMute"
                                        >
                                            <img :src="getVolumeIcon()" class="w-5 h-5" />
                                        </button>
                                        <!-- 悬浮音量条 -->
                                        <div
                                            class="volume-panel"
                                            :class="{ 'volume-panel-show': showVolumePanel }"
                                            @mouseenter="handleVolumeMouseEnter"
                                            @mouseleave="handleVolumeMouseLeave"
                                        >
                                            <div class="volume-panel-inner">
                                                <!-- 音量条背景 -->
                                                <div class="volume-track">
                                                    <!-- 音量条填充（从底部往上） -->
                                                    <div
                                                        class="volume-fill"
                                                        :style="{
                                                            height:
                                                                (playerStore.isMuted
                                                                    ? 0
                                                                    : playerStore.volume) + '%'
                                                        }"
                                                    ></div>
                                                    <!-- 可拖动滑块（覆盖整个音量条区域） -->
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        :value="
                                                            playerStore.isMuted
                                                                ? 0
                                                                : playerStore.volume
                                                        "
                                                        @input="(e) => playerStore.setVolume((e.target as HTMLInputElement).valueAsNumber)"
                                                        class="volume-slider"
                                                    />
                                                </div>
                                                <!-- 音量百分比（在下方） -->
                                                <span class="volume-text"
                                                    >{{
                                                        playerStore.isMuted
                                                            ? 0
                                                            : playerStore.volume
                                                    }}%</span
                                                >
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 播放列表 -->
                                    <button
                                        class="ctrl-btn relative"
                                        title="播放列表"
                                        @click="showPlaylist = true"
                                    >
                                        <img :src="SonglistIcon" class="w-5 h-5" />
                                        <span
                                            v-if="getPlaylistCount"
                                            class="absolute -top-0 -right-0 min-w-3 h-3 px-0.5 bg-active text-primary text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
                                        >
                                            {{ getPlaylistCount }}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <!-- 第二行：进度条 -->
                            <div class="progress-bar">
                                <span class="time">{{ formatTime(playerStore.currentTime) }}</span>
                                <div class="progress-track" @click="handleSeek">
                                    <div
                                        class="progress-fill"
                                        :style="{ width: `${progress}%` }"
                                    ></div>
                                </div>
                                <span class="time">{{ formatTime(playerStore.duration) }}</span>
                            </div>
                        </div>
                    </Transition>

                    <!-- 播放列表弹窗 -->
                    <Transition name="fade">
                        <div v-if="showPlaylist" class="playlist-modal">
                            <!-- 遮罩 -->
                            <div class="playlist-mask" @click="showPlaylist = false"></div>

                            <!-- 播放列表抽屉 -->
                            <div class="playlist-panel">
                                <!-- 头部 -->
                                <div class="playlist-header">
                                    <h2 class="playlist-title">
                                        播放队列
                                        <span class="playlist-count">
                                            ({{ playerStore.playlist.length }}首歌曲)
                                        </span>
                                    </h2>
                                    <button @click="showPlaylist = false" class="playlist-close">
                                        ✕
                                    </button>
                                </div>

                                <!-- 歌曲列表 -->
                                <div ref="playlistScrollContainer" class="playlist-content">
                                    <div
                                        v-if="playerStore.playlist.length === 0"
                                        class="playlist-empty"
                                    >
                                        暂无播放歌曲
                                    </div>

                                    <div v-else>
                                        <div
                                            v-for="(track, index) in playerStore.playlist"
                                            :key="track.id + '-' + index"
                                            :data-index="index"
                                            @click="handlePlaylistPlay(index)"
                                            class="playlist-item"
                                            :class="{
                                                'playlist-item-active':
                                                    index === playerStore.currentIndex
                                            }"
                                        >
                                            <!-- 序号/播放图标 -->
                                            <div class="playlist-item-index">
                                                <span
                                                    v-if="index === playerStore.currentIndex"
                                                    class="playlist-playing"
                                                    >▶</span
                                                >
                                                <span v-else class="playlist-number">{{
                                                    index + 1
                                                }}</span>
                                            </div>

                                            <!-- 歌曲信息 -->
                                            <div class="playlist-item-info">
                                                <div class="playlist-item-name">
                                                    {{ track.name }}
                                                </div>
                                                <div class="playlist-item-artist">
                                                    {{
                                                        track.artists
                                                            ?.map((a) => a.name)
                                                            .join(' / ') || '未知歌手'
                                                    }}
                                                </div>
                                            </div>

                                            <!-- 时长 -->
                                            <span class="playlist-item-duration">{{
                                                formatDuration(track.duration)
                                            }}</span>

                                            <!-- 删除按钮 -->
                                            <button
                                                @click="handlePlaylistRemove(index, $event)"
                                                class="playlist-item-remove"
                                            >
                                                <img :src="DeleteIcon" class="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- 底部操作栏 -->
                                <div
                                    class="flex items-center justify-between p-4 border-t border-theme"
                                >
                                    <button
                                        @click="handlePlaylistClear"
                                        class="flex items-center gap-2 px-4 py-2 w-[48%] bg-hover text-primary rounded-lg hover:scale-105 activate:scale-95 transition-all justify-center cursor-pointer"
                                    >
                                        <img :src="DeleteIcon" class="w-4 h-4" />
                                        <span>清空列表</span>
                                    </button>
                                    <button
                                        v-if="playerStore.currentTrack"
                                        @click="handlePlaylistPlayCurrent"
                                        class="flex items-center gap-2 px-4 py-2 w-[48%] bg-hover text-primary rounded-lg hover:scale-105 activate:scale-95 transition-all justify-center cursor-pointer"
                                    >
                                        <img :src="LocationIcon" class="w-5 h-5" />
                                        <span>定位当前</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.full-player-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.95);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.full-player-content {
    width: 100%;
    height: 100%;
    position: relative;
    padding: 20px;
    box-sizing: border-box;
}

.top-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    border: none;
    background: rgba(255, 255, 255, 0.5);
    color: #fff;
    font-size: 14px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.top-btn:hover {
    background: rgba(255, 255, 255, 0.7);
}

.player-main {
    display: flex;
    height: calc(100% - 100px);
    gap: 40px;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
}

.album-cover {
    flex: 0.4;
    max-width: 350px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.lyrics-area {
    flex: 0.6;
}

.cover-image {
    width: 300px;
    height: 300px;
    border-radius: 12px;
    object-fit: cover;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.cover-placeholder {
    width: 300px;
    height: 300px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60px;
}

.song-info {
    margin-top: 24px;
    text-align: center;
}

.song-name {
    color: #fff;
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
}

.song-subtitle {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin: 0 0 12px 0;
}

.song-tags {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
}

.tag {
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
}

.song-album {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    margin: 0;
}

.lyrics-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.lyrics-container {
    width: 100%;
    max-height: 500px;
    overflow-y: auto;
    padding: 20px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

.lyrics-container::-webkit-scrollbar {
    width: 6px;
}

.lyrics-container::-webkit-scrollbar-track {
    background: transparent;
}

.lyrics-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
}

.lyrics-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}

.lyrics-scroll {
    text-align: center;
}

.lyric-item {
    padding: 12px 20px;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
}

.lyric-item:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.08);
}

.lyric-current {
    font-size: 24px;
    color: #fff;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.1);
}

.lyrics-empty {
    text-align: center;
    font-size: 24px;
    color: rgba(255, 255, 255, 0.6);
    padding: 40px;
}

.bottom-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 20px 40px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
}

.bottom-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bottom-left,
.bottom-right {
    display: flex;
    gap: 16px;
}

.bottom-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
}

.ctrl-btn {
    width: 40px;
    height: 40px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ctrl-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
    transform: scale(1.1);
}

.ctrl-btn:active {
    transform: scale(0.95);
}

.ctrl-btn.disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.ctrl-btn-active {
    color: #ec407a !important;
}

/* 音量按钮组 */
.volume-btn-group {
    position: relative;
}

.volume-panel {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 12px;
    padding: 16px 12px;
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    pointer-events: none;
}

.volume-panel-show {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
}

.volume-panel-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.volume-track {
    width: 8px;
    height: 120px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
}

.volume-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #ec407a;
    border-radius: 4px;
    transition: height 0.1s ease;
}

.volume-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    writing-mode: vertical-lr;
    direction: rtl;
}

.volume-text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
}

.play-btn {
    width: 56px;
    height: 56px;
    border: none;
    background: #fff;
    color: #000;
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.play-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.play-btn:active {
    transform: scale(0.95);
}

.progress-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
}

.time {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    min-width: 40px;
}

.progress-track {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    cursor: pointer;
    position: relative;
}

.progress-fill {
    height: 100%;
    background: #fff;
    border-radius: 2px;
    transition: width 0.1s;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translateY(20px);
}

/* 播放列表样式 */
.playlist-modal {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
}

.playlist-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

.playlist-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    background: rgba(20, 20, 20, 0.95);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    box-shadow: -5px 0 30px rgba(0, 0, 0, 0.5);
}

.playlist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.playlist-title {
    color: white;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
}

.playlist-count {
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    font-weight: normal;
    margin-left: 8px;
}

.playlist-close {
    width: 36px;
    height: 36px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 16px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.playlist-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

.playlist-content {
    flex: 1;
    overflow-y: auto;
    padding: 10px 0;
}

.playlist-empty {
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
}

.playlist-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    cursor: pointer;
    transition: all 0.2s;
}

.playlist-item:hover {
    background: rgba(255, 255, 255, 0.08);
}

.playlist-item-active {
    background: rgba(255, 255, 255, 0.1);
}

.playlist-item-index {
    width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.playlist-number {
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
}

.playlist-playing {
    color: #ec407a;
    font-size: 14px;
}

.playlist-item-info {
    flex: 1;
    min-width: 0;
}

.playlist-item-name {
    color: white;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
}

.playlist-item-artist {
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.playlist-item-duration {
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
}

.playlist-item-remove {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    opacity: 0.6;
}

.playlist-item:hover .playlist-item-remove {
    opacity: 1;
}

.playlist-item-remove:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
}

.playlist-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.playlist-footer-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.playlist-footer-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
}

.playlist-footer-btn-primary {
    background: #ec407a;
    color: white;
}

.playlist-footer-btn-primary:hover {
    background: #f06292;
}

.playlist-count-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: #ec407a;
    color: white;
    font-size: 10px;
    font-weight: bold;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
