<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAlbumDetail, type AlbumDetail } from '@renderer/api/artist'
import { processImageUrl } from '@renderer/api/song'
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const myPlaylistStore = useMyPlaylistStore()
const album = ref<AlbumDetail | null>(null)
const isLoading = ref(true)
const currentTab = ref<'song' | 'comment'>('song')
const showDescModal = ref(false)
const id = Number(route.params.id)
onMounted(async () => {
    if (!id) {
        router.push('/main/home')
        return
    }
    try {
        album.value = await getAlbumDetail(id)
    } catch (error) {
        console.error('获取专辑详情失败:', error)
    } finally {
        isLoading.value = false
    }
})
const handlePlaySong = (_track: any, index: number) => {
    if (!album.value?.songs) return

    const tracks = album.value.songs.map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: t.ar || [],
        album: {
            id: t.al?.id || 0,
            name: t.al?.name || '',
            picUrl: t.al?.picUrl || ''
        },
        duration: t.dt || 0
    }))

    playerStore.setPlaylist(tracks)
    playerStore.playByIndex(index)
}
const handlePlayAll = () => {
    if (!album.value?.songs || album.value.songs.length === 0) return

    const tracks = album.value.songs.map((t: any) => ({
        id: t.id,
        name: t.name,
        artists: t.ar || [],
        album: {
            id: t.al?.id || 0,
            name: t.al?.name || '',
            picUrl: t.al?.picUrl || ''
        },
        duration: t.dt || 0
    }))

    playerStore.setPlaylist(tracks)
    playerStore.playByIndex(0)
}
const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return ''
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleAddToPlaylist = (track: any) => {
    const trackObj: Track = {
        id: track.id,
        name: track.name,
        artists: track.ar || [],
        album: {
            id: track.al?.id || 0,
            name: track.al?.name || '',
            picUrl: track.al?.picUrl || ''
        },
        duration: track.dt || 0
    }

    const playlistsWithTrack = myPlaylistStore.getPlaylistsContainingTrack(track.id)
    if (playlistsWithTrack.length > 0) {
        // 歌曲已在歌单中，从所有歌单中删除
        for (const playlist of playlistsWithTrack) {
            myPlaylistStore.removeTrackFromPlaylist(playlist.id, track.id)
        }
    } else {
        // 歌曲不在歌单中，弹窗让用户选择
        myPlaylistStore.openAddToPlaylistModal(trackObj)
    }
}

const isInAnyPlaylist = (trackId: number | string) => {
    return myPlaylistStore.getPlaylistsContainingTrack(trackId).length > 0
}
const openDescModal = () => {
    showDescModal.value = true
}
const closeDescModal = () => {
    showDescModal.value = false
}
</script>

<template>
    <div v-if="isLoading" class="flex items-center justify-center h-64">
        <div class="text-gray-400">加载中...</div>
    </div>

    <div v-else-if="album" class="min-h-screen bg-secondary">
        <!-- 头部信息 -->
        <div class="header">
            <div class="cover">
                <img
                    :src="processImageUrl(album.picUrl, 300)"
                    :alt="album.name"
                    class="w-full h-full object-cover"
                />
            </div>
            <div class="info">
                <div class="info-content">
                    <h1 class="title">{{ album.name }}</h1>
                    <p
                        class="description line-clamp-1 cursor-pointer hover:text-gray-700 transition-colors"
                        @click="openDescModal"
                        :title="album.description"
                    >
                        {{ album.description }}
                    </p>
                    <div class="meta">
                        <span>{{ album.artist.name }}</span>
                        <span>{{ album.songs.length }} 首歌曲</span>
                        <span v-if="album.duration && album.duration > 0">{{
                            formatDuration(album.duration)
                        }}</span>
                        <span>{{ album.publishTime }}</span>
                    </div>
                </div>
                <div class="actions">
                    <button class="btn btn-primary" @click="handlePlayAll">▶ 播放全部</button>
                </div>
            </div>
        </div>

        <!-- 内容区域 -->
        <div class="content">
            <!-- 歌曲列表 -->
            <table v-if="currentTab === 'song'" class="track-table w-full">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>标题</th>
                        <th class="text-center">操作</th>
                        <th>时长</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="(track, index) in album.songs"
                        :key="track.id"
                        class="track-row transition-all duration-200 hover:scale-105"
                    >
                        <td class="track-index">{{ index + 1 }}</td>
                        <td class="track-name">
                            <div class="track-cover">
                                <img
                                    v-if="track.al?.picUrl"
                                    :src="processImageUrl(track.al.picUrl, 50)"
                                    class="w-full h-full object-cover"
                                />
                            </div>
                            <div class="track-info">
                                <span class="track-title">{{ track.name }}</span>
                                <span class="track-artists">{{
                                    track.ar?.map((a) => a.name).join(' / ')
                                }}</span>
                            </div>
                        </td>
                        <td class="track-actions">
                            <button class="btn-icon" @click.stop="handlePlaySong(track, index)">
                                <img :src="PlayIcon" class="w-4 h-4" />
                            </button>
                            <button
                                class="btn-icon"
                                :class="{ 'text-red-500': isInAnyPlaylist(track.id) }"
                                @click.stop="handleAddToPlaylist(track)"
                            >
                                <img
                                    :src="isInAnyPlaylist(track.id) ? LikeIcon : LikeNoIcon"
                                    class="w-4 h-4"
                                />
                            </button>
                        </td>
                        <td class="track-duration">{{ formatDuration(track.dt || 0) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 描述弹窗 -->
    <Teleport to="body">
        <div
            v-if="showDescModal"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            @click="closeDescModal"
        >
            <div
                class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[70vh] overflow-auto"
                @click.stop
            >
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">专辑简介</h3>
                    <button
                        class="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
                        @click="closeDescModal"
                    >
                        ×
                    </button>
                </div>
                <p class="text-gray-600 whitespace-pre-line leading-relaxed">
                    {{ album?.description }}
                </p>
            </div>
        </div>
    </Teleport>

    <!-- 添加到歌单弹窗 -->
    <Teleport to="body">
        <div
            v-if="myPlaylistStore.showAddToPlaylistModal"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            @click.self="myPlaylistStore.closeAddToPlaylistModal()"
        >
            <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
                <h3 class="text-lg font-bold text-gray-800 mb-4">添加到歌单</h3>
                <div class="mb-4">
                    <p class="text-sm text-gray-500 mb-2">选择要添加的歌单：</p>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        <div
                            v-for="playlist in myPlaylistStore.playlists"
                            :key="playlist.id"
                            @click="myPlaylistStore.handleAddToPlaylist(playlist.id)"
                            class="flex items-center gap-3 p-3 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                            <div class="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                                <div v-if="playlist.picUrl" class="w-full h-full">
                                    <img
                                        :src="playlist.picUrl"
                                        class="w-full h-full object-cover"
                                    />
                                </div>
                                <div
                                    v-else
                                    class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-lg"
                                >
                                    {{ playlist.isDefault ? '❤️' : '🎵' }}
                                </div>
                            </div>
                            <div class="flex-1">
                                <p class="text-gray-800 text-sm font-medium">{{ playlist.name }}</p>
                                <p class="text-gray-400 text-xs">
                                    {{ playlist.trackCount }} 首歌曲
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end">
                    <button
                        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        @click="myPlaylistStore.closeAddToPlaylistModal()"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.playlist-detail {
    min-height: 100%;
    background: var(--color-bg-secondary);
    user-select: none;
}

.loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: #999;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #e84a5f;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.content {
    padding: 40px;
}

.header {
    display: flex;
    gap: 30px;
    margin-bottom: 40px;
}

.cover {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    object-fit: cover;
}

.local-cover {
    background: linear-gradient(135deg, #e9d5ff, #fbcfe8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60px;
}

.info {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    min-height: 200px;
}

.actions {
    display: flex;
    gap: 12px;
    position: absolute;
    bottom: 0;
    left: 0;
}

.title {
    font-size: 28px;
    font-weight: bold;
    color: var(--color-text-primary);
    margin-bottom: 16px;
}

.description {
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
}

.line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.meta {
    display: flex;
    gap: 20px;
    align-items: center;
    margin-bottom: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.badge {
    background: linear-gradient(135deg, #e84a5f, #ff9a9e);
    color: #fff;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
}

.actions {
    display: flex;
    gap: 12px;
}

.btn {
    padding: 10px 24px;
    border-radius: 25px;
    border: none;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: linear-gradient(135deg, #e84a5f, #ff9a9e);
    color: #fff;
}

.btn-primary:hover {
    transform: scale(1.02);
}

.btn-secondary {
    background: linear-gradient(130deg, #e84a5f, #ff9a9e);
    color: #fff;
}

.btn-secondary:hover {
    transform: scale(1.02);
}

.btn-favorite {
    background: linear-gradient(130deg, #e84a5f, #ff9a9e);
    color: #fff;
}

.tracks {
    margin-top: 20px;
}

.track-table {
    width: 100%;
    border-collapse: collapse;
}

.track-table th {
    text-align: left;
    padding: 12px 16px;
    background: var(--color-bg-hover);
    color: var(--color-text-secondary);
    font-weight: normal;
    font-size: 14px;
}

.track-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border-theme);
}

.track-row:hover {
    background: var(--color-bg-hover);
}

.track-index {
    width: 40px;
    color: var(--color-text-muted);
    font-size: 14px;
}

.track-name {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 50%;
}

.track-cover {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
}

.track-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.track-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.track-title {
    font-size: 14px;
    color: var(--color-text-primary);
}

.track-artists {
    font-size: 12px;
    color: var(--color-text-muted);
}

.track-album {
    color: var(--color-text-muted);
    font-size: 14px;
    justify-items: center;
    width: 30%;
}

.track-actions {
    color: var(--color-text-muted);
    font-size: 14px;
}

.btn-icon {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    transition: all 0.2s;
}

.btn-icon:hover {
    background: var(--color-bg-hover);
    color: var(--color-accent);
}

.btn-icon.btn-favorite {
    color: var(--color-accent);
}

.track-duration {
    color: var(--color-text-muted);
    font-size: 14px;
}

.empty-track {
    text-align: center;
    padding: 100px 0;
    color: var(--color-text-muted);
}
</style>