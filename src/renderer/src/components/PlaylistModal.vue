<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { usePlayerStore } from '@renderer/stores/player'
import DeleteIcon from '@renderer/assets/icons/playlistmodal/delete.svg'
import LocationIcon from '@renderer/assets/icons/playlistmodal/location.svg'
import CloseIcon from '@renderer/assets/icons/close.svg'

const playerStore = usePlayerStore()
const scrollContainer = ref<HTMLElement | null>(null)

const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlay = async (index: number) => {
    await playerStore.playByIndex(index)
}

const handleRemove = (index: number, event: Event) => {
    event.stopPropagation()
    playerStore.removeFromQueue(index)
}

const handleClose = () => {
    playerStore.showPlaylist = false
}

const handleClear = () => {
    playerStore.clearQueue()
}

const handlePlayCurrent = () => {
    if (playerStore.currentIndex >= 0) {
        nextTick(() => {
            const container = scrollContainer.value
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
</script>

<template>
    <Teleport to="body">
        <Transition name="playlist">
            <div v-if="playerStore.showPlaylist" class="fixed inset-0 z-[100]">
                <!-- 遮罩 -->
                <div class="absolute inset-0 bg-black/50" @click="handleClose"></div>

                <!-- 右侧抽屉 -->
                <div
                    class="absolute top-0 right-0 bottom-0 w-96 bg-secondary shadow-2xl flex flex-col select-none border-l border-theme"
                >
                    <!-- 头部 -->
                    <div class="flex items-center justify-between p-4 border-b border-theme">
                        <div class="flex flex-col">
                            <h2 class="text-lg font-bold text-primary">播放列表</h2>
                            <span class="text-sm font-normal text-secondary">
                                {{ playerStore.playlist.length }}首歌曲
                            </span>
                        </div>
                        <button
                            @click="handleClose"
                            class="w-8 h-8 flex items-center justify-center hover:bg-hover rounded-full duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                        >
                            <img :src="CloseIcon" class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- 歌曲列表 -->
                    <div ref="scrollContainer" class="flex-1 overflow-y-auto overflow-x-hidden">
                        <div
                            v-if="playerStore.playlist.length === 0"
                            class="py-12 text-center text-muted"
                        >
                            暂无播放歌曲
                        </div>

                        <div v-else>
                            <div
                                v-for="(track, index) in playerStore.playlist"
                                :key="track.id + '-' + index"
                                :data-index="index"
                                @click="handlePlay(index)"
                                class="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 overflow-x-hidden"
                                :class="{
                                    'bg-active hover:scale-105': index === playerStore.currentIndex,
                                    'hover:bg-hover hover:scale-105':
                                        index !== playerStore.currentIndex
                                }"
                            >
                                <!-- 序号/播放图标 -->
                                <div class="w-8 flex items-center justify-center">
                                    <span
                                        v-if="index === playerStore.currentIndex"
                                        class="text-accent text-lg"
                                        >▶</span
                                    >
                                    <span v-else class="text-muted text-sm">{{ index + 1 }}</span>
                                </div>

                                <!-- 歌曲信息 -->
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-primary truncate">{{ track.name }}</span>
                                    </div>
                                    <div class="text-secondary text-xs truncate">
                                        {{
                                            track.artists?.map((a) => a.name).join(' / ') ||
                                            '未知歌手'
                                        }}
                                    </div>
                                </div>

                                <!-- 时长 -->
                                <span class="text-secondary text-xs">{{
                                    formatDuration(track.duration)
                                }}</span>

                                <!-- 删除按钮 -->
                                <button
                                    @click="handleRemove(index, $event)"
                                    class="w-8 h-8 flex items-center justify-center rounded-full duration-200 hover:bg-hover hover:scale-110 active:scale-95 cursor-pointer"
                                >
                                    <img :src="DeleteIcon" class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 底部操作栏 -->
                    <div
                        class="flex items-center justify-between p-4 border-t border-theme bg-primary"
                    >
                        <button
                            @click="handleClear"
                            class="flex items-center gap-2 px-4 py-2 w-[48%] bg-hover text-primary hover:bg-active rounded-lg transition-all justify-center cursor-pointer"
                        >
                            <img :src="DeleteIcon" class="w-4 h-4" />
                            <span>清空列表</span>
                        </button>
                        <button
                            v-if="playerStore.currentTrack"
                            @click="handlePlayCurrent"
                            class="flex items-center gap-2 px-4 py-2 w-[48%] bg-hover text-primary rounded-lg hover:bg-active transition-all justify-center cursor-pointer"
                        >
                            <img :src="LocationIcon" class="w-5 h-5" />
                            <span>定位当前</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.playlist-enter-active,
.playlist-leave-active {
    transition: opacity 0.3s ease;
}

.playlist-enter-active .absolute.right-0,
.playlist-leave-active .absolute.right-0 {
    transition: transform 0.3s ease-out;
}

.playlist-enter-from,
.playlist-leave-to {
    opacity: 0;
}

.playlist-enter-from .absolute.right-0,
.playlist-leave-to .absolute.right-0 {
    transform: translateX(100%);
}
</style>
