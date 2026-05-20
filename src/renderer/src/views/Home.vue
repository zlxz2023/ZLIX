<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getRecommendPlaylists, type Playlist } from '@renderer/api/playlist'
import { getTopArtists, type Artist } from '@renderer/api/artist'
import { getAllMv, type Mv } from '@renderer/api/mv'
import { getMvUrl } from '@renderer/api/mv'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import { logger } from '@renderer/utils/logger'

const router = useRouter()
const playlists = ref<Playlist[]>([])
const artists = ref<Artist[]>([])
const mvs = ref<Mv[]>([])
const isLoading = ref(true)

const showVideoPlayer = ref(false)
const currentVideoUrl = ref('')
const currentVideoTitle = ref('')

const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 12) {
        return '早上好'
    } else if (hour >= 12 && hour < 14) {
        return '中午好'
    } else if (hour >= 14 && hour < 18) {
        return '下午好'
    } else {
        return '晚上好'
    }
})

const fetchData = async () => {
    isLoading.value = true
    try {
        const [playlistRes, artistRes, mvRes] = await Promise.all([
            getRecommendPlaylists(30),
            getTopArtists(8),
            getAllMv(10)
        ])
        playlists.value = playlistRes
        artists.value = artistRes
        mvs.value = mvRes
    } catch (error: any) {
        logger.error('Home', '获取数据失败', error)
    } finally {
        isLoading.value = false
    }
}

const formatPlayCount = (count: number) => {
    if (count >= 100000000) {
        return (count / 100000000).toFixed(1) + '亿'
    } else if (count >= 10000) {
        return (count / 10000).toFixed(1) + '万'
    }
    return count.toString()
}

const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlaylistClick = async (playlist: Playlist) => {
    try {
        await router.push(`/main/playlist/${playlist.id}`)
    } catch (error: any) {
        logger.error('Home', '跳转歌单失败', error)
    }
}

const handleArtistClick = async (artist: { id: number; name: string }) => {
    try {
        await router.push(`/main/artist/${artist.id}`)
    } catch (error: any) {
        logger.error('Home', '跳转歌手失败', error)
    }
}

const handleMvClick = async (mv: Mv) => {
    const url = await getMvUrl(mv.id)
    if (url) {
        currentVideoUrl.value = url
        currentVideoTitle.value = mv.name
        showVideoPlayer.value = true
    } else {
        logger.error('Home', '无法获取MV播放地址')
    }
}

const handleCloseVideoPlayer = () => {
    showVideoPlayer.value = false
}

const goToDiscoverPlaylist = () => {
    router.push({ path: '/main/discover', query: { tab: 'playlist' } })
}

const goToDiscoverArtist = () => {
    router.push({ path: '/main/discover', query: { tab: 'artist' } })
}

onMounted(() => {
    fetchData()
})
</script>

<template>
    <div class="home-page p-6 bg-secondary min-h-screen select-none">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="flex items-center justify-center h-64">
            <div class="text-gray-400">加载中...</div>
        </div>

        <template v-else>
            <!-- 欢迎文字 -->
            <div class="mb-8">
                <h1 class="text-4xl font-extrabold text-primary">{{ greeting }}</h1>
                <p class="text-gray-500 text-sm mt-1">今天想听点什么？</p>
            </div>

            <!-- 推荐歌单 -->
            <section class="mb-10">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-primary">推荐歌单</h2>
                    <button
                        @click="goToDiscoverPlaylist"
                        class="text-secondary hover:text-primary transition-all text-sm cursor-pointer"
                    >
                        查看更多
                    </button>
                </div>

                <div
                    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5"
                >
                    <div
                        v-for="item in playlists"
                        :key="item.id"
                        class="playlist-card group cursor-pointer transition-all duration-200 active:scale-95 hover:scale-[1.02]"
                        @click="handlePlaylistClick(item)"
                    >
                        <div
                            class="relative w-full aspect-square rounded-xl mb-3 overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200"
                        >
                            <img
                                v-if="item.picUrl"
                                :src="item.picUrl"
                                :alt="item.name"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div
                                v-else
                                class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-4xl"
                            >
                                🎵
                            </div>
                            <!-- 播放量 -->
                            <div
                                v-if="item.playCount"
                                class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                            >
                                <span>▶</span>
                                <span>{{ formatPlayCount(item.playCount) }}</span>
                            </div>
                        </div>
                        <h3 class="text-primary font-medium text-sm leading-snug line-clamp-2">
                            {{ item.name }}
                        </h3>
                    </div>
                </div>
            </section>

            <!-- 推荐歌手 -->
            <section class="mb-10">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-xl font-bold text-primary">推荐歌手</h2>
                    <button
                        @click="goToDiscoverArtist"
                        class="text-secondary hover:text-primary transition-colors text-sm cursor-pointer"
                    >
                        查看更多
                    </button>
                </div>

                <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5">
                    <div
                        v-for="item in artists"
                        :key="item.id"
                        class="artist-card group cursor-pointer text-center transition-all duration-200 active:scale-95 hover:scale-[1.05]"
                        @click="handleArtistClick(item)"
                    >
                        <div
                            class="w-full aspect-square rounded-full mb-3 overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200"
                        >
                            <img
                                v-if="item.picUrl"
                                :src="item.picUrl"
                                :alt="item.name"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div
                                v-else
                                class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-3xl"
                            >
                                🎤
                            </div>
                        </div>
                        <h3 class="text-primary text-sm truncate">{{ item.name }}</h3>
                        <p v-if="item.albumSize" class="text-secondary text-xs">
                            {{ item.albumSize }}张专辑
                        </p>
                    </div>
                </div>
            </section>

            <!-- 推荐MV -->
            <section>
                <h2 class="text-xl font-bold text-primary mb-6">推荐MV</h2>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    <div
                        v-for="item in mvs"
                        :key="item.id"
                        class="mv-card group cursor-pointer transition-all duration-200 active:scale-95 hover:scale-[1.02]"
                        @click="handleMvClick(item)"
                    >
                        <div
                            class="relative w-full aspect-video rounded-xl mb-3 overflow-hidden shadow-sm group-hover:shadow-md transition-shadow duration-200"
                        >
                            <img
                                v-if="item.cover"
                                :src="item.cover"
                                :alt="item.name"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <!-- 时长 -->
                            <div
                                v-if="item.duration"
                                class="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded"
                            >
                                {{ formatDuration(item.duration) }}
                            </div>
                            <!-- 播放图标 -->
                            <div
                                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"
                            >
                                <div
                                    class="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
                                >
                                    <span class="text-xl">
                                        <img
                                            :src="PlayIcon"
                                            class="w-4 h-4 transform translate-x-0.5"
                                        />
                                    </span>
                                </div>
                            </div>
                        </div>
                        <h3 class="text-primary font-medium text-sm truncate">{{ item.name }}</h3>
                        <p v-if="item.artistName" class="text-secondary text-xs mt-1">
                            {{ item.artistName }}
                        </p>
                    </div>
                </div>
            </section>
        </template>

        <!-- MV播放器弹窗 -->
        <VideoPlayer
            :visible="showVideoPlayer"
            :video-url="currentVideoUrl"
            :title="currentVideoTitle"
            @close="handleCloseVideoPlayer"
        />
    </div>
</template>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>