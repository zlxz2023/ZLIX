<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPlaylistDetail, type PlaylistDetail, type PlaylistTrack } from '@renderer/api/playlist'
import { processImageUrl } from '@renderer/api/song'
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useFavoriteStore } from '@renderer/stores/favorites'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'

const route = useRoute()
const playerStore = usePlayerStore()
const favoriteStore = useFavoriteStore()
const myPlaylistStore = useMyPlaylistStore()
const playlist = ref<PlaylistDetail | null>(null)
const localPlaylist = computed(() => {
    const id = route.params.id as string
    return myPlaylistStore.playlists.find((p) => p.id === id)
})
const loading = ref(true)

const isLocalPlaylist = computed(() => {
    const id = route.params.id as string
    return id.startsWith('local_')
})

const isFavorite = computed(() => {
    if (!playlist.value) return false
    return favoriteStore.isFavorite(playlist.value.id)
})

const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatPlayCount = (count: number): string => {
    if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
    return count.toString()
}

const handlePlayTrack = async (track: Track | PlaylistTrack) => {
    const t = track as any
    const trackObj: Track = {
        id: t.id,
        name: t.name,
        artists: t.artists || t.ar || [],
        album: t.album || {
            id: t.al?.id || 0,
            name: t.al?.name || '',
            picUrl: t.al?.picUrl || ''
        },
        duration: t.duration || t.dt || 0,
        url: undefined
    }
    playerStore.playTrack(trackObj)
}

const handlePlayAllLocal = async () => {
    if (!localPlaylist.value?.tracks?.length) return

    playerStore.setPlaylist(localPlaylist.value.tracks, 0)
    await playerStore.playByIndex(0)
}

const handleRemoveFromPlaylist = (trackId: number | string) => {
    const id = route.params.id as string
    myPlaylistStore.removeTrackFromPlaylist(id, trackId)
}

const handlePlayAll = async () => {
    if (!playlist.value?.tracks?.length) return

    const tracks: Track[] = playlist.value.tracks.map((track) => {
        const t = track as any
        return {
            id: t.id,
            name: t.name,
            artists: t.ar || [],
            album: {
                name: t.al?.name || '',
                picUrl: processImageUrl(t.al?.picUrl || '', 300)
            },
            duration: t.duration || t.dt || 0,
            url: undefined
        }
    })

    playerStore.setPlaylist(tracks, 0)
    await playerStore.playByIndex(0)
}

const loadPlaylistDetail = async () => {
    loading.value = true
    const id = route.params.id as string

    if (id.startsWith('local_')) {
        playlist.value = null
        loading.value = false
        return
    }

    try {
        const numId = Number(id)
        playlist.value = await getPlaylistDetail(numId)
        if (playlist.value.coverImgUrl) {
            playlist.value.coverImgUrl = processImageUrl(playlist.value.coverImgUrl, 300)
        }
        if (playlist.value.tracks) {
            playlist.value.tracks = playlist.value.tracks.map((track) => ({
                ...track,
                al: {
                    ...track.al,
                    picUrl: processImageUrl(track.al.picUrl, 100)
                }
            }))
        }
    } catch (error) {
        console.error('获取歌单详情失败:', error)
    } finally {
        loading.value = false
    }
}

const handleToggleFavorite = () => {
    if (!playlist.value) return
    favoriteStore.toggleFavorite({
        id: playlist.value.id,
        name: playlist.value.name,
        picUrl: playlist.value.coverImgUrl,
        playCount: playlist.value.playCount,
        trackCount: playlist.value.trackCount,
        description: playlist.value.description,
        creator: playlist.value.creator
    })
}

const handleToggleTrackFavorite = (track: PlaylistTrack) => {
    const t = track as any
    const trackObj: Track = {
        id: t.id,
        name: t.name,
        artists: t.ar || [],
        album: {
            name: t.al?.name || '',
            picUrl: processImageUrl(t.al?.picUrl || '', 300)
        },
        duration: t.duration || t.dt || 0,
        url: undefined
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

const showDescModal = ref(false)
const openDescModal = () => {
    showDescModal.value = true
}
const closeDescModal = () => {
    showDescModal.value = false
}

onMounted(() => {
    loadPlaylistDetail()
})
</script>

<template>
    <div class="playlist-detail">
        <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
        </div>

        <!-- 本地歌单 -->
        <div v-else-if="isLocalPlaylist && localPlaylist" class="content">
            <div class="header">
                <div class="cover local-cover">
                    {{ localPlaylist.isDefault ? '❤️' : '🎵' }}
                </div>
                <div class="info">
                    <h1 class="title">{{ localPlaylist.name }}</h1>
                    <div class="meta">
                        <span class="track-count"> {{ localPlaylist.trackCount }}首 </span>
                        <span v-if="localPlaylist.isDefault" class="badge">默认歌单</span>
                    </div>
                    <div class="actions">
                        <button class="btn btn-primary" @click="handlePlayAllLocal">
                            ▶ 播放全部
                        </button>
                    </div>
                </div>
            </div>
            <div class="tracks">
                <div
                    v-if="!localPlaylist.tracks || localPlaylist.tracks.length === 0"
                    class="empty-track"
                >
                    <span>暂无歌曲</span>
                </div>
                <table v-else class="track-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>标题</th>
                            <th>专辑</th>
                            <th>操作</th>
                            <th>时长</th>
                        </tr>
                    </thead>
                    <tbody class="cursor-pointer">
                        <tr
                            v-for="(track, index) in localPlaylist.tracks"
                            :key="track.id"
                            class="track-row transition-all duration-200 hover:scale-105"
                        >
                            <td class="track-index">{{ index + 1 }}</td>
                            <td class="track-name">
                                <div class="track-cover">
                                    <img :src="track.album.picUrl" :alt="track.album.name" />
                                </div>
                                <div class="track-info">
                                    <span class="track-title">{{ track.name }}</span>
                                    <span class="track-artists">{{
                                        track.artists.map((a) => a.name).join(' / ')
                                    }}</span>
                                </div>
                            </td>
                            <td class="track-album">{{ track.album.name }}</td>
                            <td class="track-actions">
                                <button class="btn-icon" @click="handlePlayTrack(track)">
                                    <img :src="PlayIcon" class="w-3 h-3" />
                                </button>
                                <button
                                    class="btn-icon"
                                    @click="handleRemoveFromPlaylist(track.id)"
                                >
                                    <svg
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                    >
                                        <path
                                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                                        />
                                    </svg>
                                </button>
                            </td>
                            <td class="track-duration">{{ formatDuration(track.duration) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 网易云歌单 -->
        <div v-else-if="playlist" class="content">
            <div class="header">
                <img :src="playlist.coverImgUrl" :alt="playlist.name" class="cover" />
                <div class="info">
                    <h1 class="title">{{ playlist.name }}</h1>
                    <p
                        class="description line-clamp-1 cursor-pointer text-secondary hover:text-primary transition-colors"
                        v-if="playlist.description"
                        @click="openDescModal"
                        :title="playlist.description"
                    >
                        {{ playlist.description }}
                    </p>
                    <div class="meta">
                        <span class="creator" v-if="playlist.creator">
                            {{ playlist.creator.nickname }}
                        </span>
                        <span class="play-count">
                            {{ formatPlayCount(playlist.playCount) }}次播放
                        </span>
                        <span class="track-count"> {{ playlist.trackCount }}首 </span>
                    </div>
                    <div class="actions">
                        <button class="btn btn-primary" @click="handlePlayAll">▶ 播放全部</button>
                        <button
                            class="btn btn-secondary"
                            :class="{ 'btn-favorite': isFavorite }"
                            @click="handleToggleFavorite"
                        >
                            {{ isFavorite ? '❤️ 收藏' : '🤍 收藏' }}
                        </button>
                    </div>
                </div>
            </div>
            <div class="tracks">
                <table class="track-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>标题</th>
                            <th>专辑</th>
                            <th>操作</th>
                            <th>时长</th>
                        </tr>
                    </thead>
                    <tbody class="cursor-pointer">
                        <tr
                            v-for="(track, index) in playlist.tracks"
                            :key="track.id"
                            class="track-row transition-all duration-200 hover:scale-105"
                        >
                            <td class="track-index">{{ index + 1 }}</td>
                            <td class="track-name">
                                <div class="track-cover">
                                    <img :src="track.al.picUrl" :alt="track.al.name" />
                                </div>
                                <div class="track-info">
                                    <span class="track-title">{{ track.name }}</span>
                                    <span class="track-artists">{{
                                        track.ar.map((a) => a.name).join(' / ')
                                    }}</span>
                                </div>
                            </td>
                            <td class="track-album">{{ track.al.name }}</td>
                            <td class="track-actions">
                                <button class="btn-icon" @click="handlePlayTrack(track)">
                                    <img :src="PlayIcon" class="w-4 h-4" />
                                </button>
                                <button
                                    class="btn-icon"
                                    :class="{ 'btn-favorite': isInAnyPlaylist(track.id) }"
                                    @click="handleToggleTrackFavorite(track)"
                                >
                                    <img
                                        :src="isInAnyPlaylist(track.id) ? LikeIcon : LikeNoIcon"
                                        class="w-4 h-4"
                                    />
                                </button>
                            </td>
                            <td class="track-duration">
                                {{ formatDuration(track.duration || (track as any).dt) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-else class="loading-container">
            <span>歌单不存在</span>
        </div>

        <!-- 描述弹窗 -->
        <Teleport to="body">
            <div
                v-if="showDescModal"
                class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="closeDescModal"
            >
                <div
                    class="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[70vh] overflow-auto"
                    @click.stop
                >
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-bold text-primary">歌单简介</h3>
                        <button
                            class="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
                            @click="closeDescModal"
                        >
                            ×
                        </button>
                    </div>
                    <p class="text-gray-600 whitespace-pre-line leading-relaxed">
                        {{ playlist?.description }}
                    </p>
                </div>
            </div>
        </Teleport>

        <!-- 添加到歌单弹窗 -->
        <div
            v-if="myPlaylistStore.showAddToPlaylistModal"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            @click.self="myPlaylistStore.closeAddToPlaylistModal()"
        >
            <div class="bg-white rounded-xl p-6 w-96 shadow-xl">
                <h2 class="text-xl font-bold text-primary mb-4">添加到歌单</h2>
                <div class="mb-4">
                    <p class="text-secondary text-sm mb-2">选择要添加的歌单：</p>
                    <div class="space-y-2 max-h-64 overflow-y-auto">
                        <div
                            v-for="playlistItem in myPlaylistStore.playlists"
                            :key="playlistItem.id"
                            @click="myPlaylistStore.handleAddToPlaylist(playlistItem.id)"
                            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                                <div v-if="playlistItem.picUrl" class="w-full h-full">
                                    <img
                                        :src="playlistItem.picUrl"
                                        class="w-full h-full object-cover"
                                    />
                                </div>
                                <div
                                    v-else
                                    class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-lg"
                                >
                                    {{ playlistItem.isDefault ? '❤️' : '🎵' }}
                                </div>
                            </div>
                            <div class="flex-1">
                                <p class="text-gray-800 text-sm font-medium">
                                    {{ playlistItem.name }}
                                </p>
                                <p class="text-gray-400 text-xs">
                                    {{ playlistItem.trackCount }} 首歌曲
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end">
                    <button
                        class="px-4 py-4 bg-hover text-primary rounded-lg hover:bg-active transition-colors"
                        @click="myPlaylistStore.closeAddToPlaylistModal()"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    </div>
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