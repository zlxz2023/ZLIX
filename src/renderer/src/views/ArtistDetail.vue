<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    getArtistDetail,
    getArtistTopSongs,
    getArtistAlbums,
    getArtistMvs,
    type ArtistDetail,
    type ArtistAlbum,
    type ArtistMv,
    type Song
} from '@renderer/api/artist'
import { getMvUrl } from '@renderer/api/mv'
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'
import MusicIcon from '@renderer/assets/icons/music.svg'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const myPlaylistStore = useMyPlaylistStore()

const artist = ref<ArtistDetail | null>(null)
const songs = ref<Song[]>([])
const albums = ref<ArtistAlbum[]>([])
const mvs = ref<ArtistMv[]>([])
const activeTab = ref<'songs' | 'albums' | 'mvs'>('songs')
const loading = ref(true)

const showVideoPlayer = ref(false)
const currentVideoUrl = ref('')
const currentVideoTitle = ref('')

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

const handlePlayTrack = async (track: Song) => {
    const trackObj: Track = {
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration: track.duration,
        url: undefined
    }

    playerStore.playTrack(trackObj)
}

const handleAddToPlaylist = (track: Song) => {
    const trackObj: Track = {
        id: track.id,
        name: track.name,
        artists: track.artists,
        album: track.album,
        duration: track.duration,
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

const handlePlayAll = async () => {
    if (!songs.value.length) return

    const tracks: Track[] = songs.value.map((song) => ({
        id: song.id,
        name: song.name,
        artists: song.artists,
        album: song.album,
        duration: song.duration,
        url: undefined
    }))

    playerStore.setPlaylist(tracks, 0)
    playerStore.playByIndex(0)
}

const handlePlayMv = async (mv: ArtistMv) => {
    console.log('播放MV:', mv.name)
    const url = await getMvUrl(mv.id)
    if (url) {
        currentVideoUrl.value = url
        currentVideoTitle.value = mv.name
        showVideoPlayer.value = true
    } else {
        console.error('无法获取MV播放地址')
    }
}

const handleCloseVideoPlayer = () => {
    showVideoPlayer.value = false
}

const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
        .getDate()
        .toString()
        .padStart(2, '0')}`
}

const loadArtistDetail = async () => {
    loading.value = true
    const id = Number(route.params.id)

    try {
        const [artistData, songsData, albumsData, mvsData] = await Promise.all([
            getArtistDetail(id),
            getArtistTopSongs(id),
            getArtistAlbums(id),
            getArtistMvs(id)
        ])

        artist.value = artistData
        songs.value = songsData
        albums.value = albumsData
        mvs.value = mvsData
    } catch (error) {
        console.error('获取歌手详情失败:', error)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    loadArtistDetail()
})
</script>

<template>
    <div class="artist-detail">
        <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
        </div>
        <div v-else-if="artist" class="content select-none">
            <!-- Header -->
            <div class="header">
                <img :src="artist.picUrl" :alt="artist.name" class="cover" />
                <div class="info">
                    <h1 class="title">{{ artist.name }}</h1>
                    <p
                        class="brief-desc line-clamp-1 cursor-pointer text-secondary hover:text-primary transition-colors"
                        v-if="artist.briefDesc"
                        @click="openDescModal"
                        :title="artist.briefDesc"
                    >
                        {{ artist.briefDesc }}
                    </p>
                    <div class="meta">
                        <span class="meta-item" v-if="artist.albumSize">
                            <img :src="MusicIcon" class="w-5 h-5" />
                            {{ artist.albumSize }}张专辑
                        </span>
                    </div>
                    <div class="actions">
                        <button class="btn btn-primary" @click="handlePlayAll">▶ 播放全部</button>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="tabs">
                <button
                    v-for="tab in [
                        { key: 'songs', label: '单曲' },
                        { key: 'albums', label: '专辑' },
                        { key: 'mvs', label: '视频' }
                    ]"
                    :key="tab.key"
                    class="tab"
                    :class="{ active: activeTab === tab.key }"
                    @click="activeTab = tab.key as any"
                >
                    {{ tab.label }}
                </button>
            </div>

            <!-- Songs Tab -->
            <div v-show="activeTab === 'songs'" class="songs-tab">
                <table class="songs-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>标题</th>
                            <th>专辑</th>
                            <th>操作</th>
                            <th>时长</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(song, index) in songs"
                            :key="song.id"
                            class="song-row transition-all duration-200 hover:scale-105"
                        >
                            <td class="song-index">{{ index + 1 }}</td>
                            <td class="song-name">
                                <div class="song-cover">
                                    <img :src="song.album.picUrl" :alt="song.album.name" />
                                </div>
                                <div class="song-info">
                                    <span class="song-title">{{ song.name }}</span>
                                    <span class="song-artists">{{
                                        song.artists.map((a) => a.name).join(' / ')
                                    }}</span>
                                </div>
                            </td>
                            <td class="song-album">{{ song.album.name }}</td>
                            <td class="song-actions">
                                <button class="btn-icon" @click="handlePlayTrack(song)">
                                    <img :src="PlayIcon" class="w-4 h-4" />
                                </button>
                                <button
                                    class="btn-icon"
                                    :class="{ 'text-red-500': isInAnyPlaylist(song.id) }"
                                    @click="handleAddToPlaylist(song)"
                                >
                                    <img
                                        :src="isInAnyPlaylist(song.id) ? LikeIcon : LikeNoIcon"
                                        class="w-4 h-4"
                                    />
                                </button>
                            </td>
                            <td class="song-duration">{{ formatDuration(song.duration) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Albums Tab -->
            <div v-show="activeTab === 'albums'" class="albums-tab">
                <div class="albums-grid">
                    <div
                        v-for="album in albums"
                        :key="album.id"
                        class="album-card cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
                        @click="router.push(`/main/album/${album.id}`)"
                    >
                        <img :src="album.picUrl" :alt="album.name" class="album-cover" />
                        <h3 class="album-name">{{ album.name }}</h3>
                        <p class="album-meta">
                            {{ album.publishTime ? formatDate(album.publishTime) : '' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Mvs Tab -->
            <div v-show="activeTab === 'mvs'" class="mvs-tab">
                <div class="mvs-grid">
                    <div
                        v-for="mv in mvs"
                        :key="mv.id"
                        class="mv-card cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
                        @click="handlePlayMv(mv)"
                    >
                        <div class="mv-cover-wrapper">
                            <img :src="mv.cover" :alt="mv.name" class="mv-cover" />
                            <div class="mv-play-count" v-if="mv.playCount">
                                <span>▶</span>
                                <span>{{ formatPlayCount(mv.playCount) }}</span>
                            </div>
                            <!-- 播放按钮覆盖层 -->
                            <div class="mv-play-overlay">
                                <div class="mv-play-btn">
                                    <img
                                        :src="PlayIcon"
                                        class="w-4 h-4 transform translate-x-0.5"
                                    />
                                </div>
                            </div>
                        </div>
                        <h3 class="mv-name">{{ mv.name }}</h3>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <VideoPlayer
        :visible="showVideoPlayer"
        :video-url="currentVideoUrl"
        :title="currentVideoTitle"
        @close="handleCloseVideoPlayer"
    />

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
                    <h3 class="text-lg font-bold text-primary">歌手简介</h3>
                    <button
                        class="text-secondary hover:text-primary transition-colors text-2xl"
                        @click="closeDescModal"
                    >
                        ×
                    </button>
                </div>
                <p class="text-secondary whitespace-pre-line leading-relaxed">
                    {{ artist?.briefDesc }}
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
        <div class="bg-secondary rounded-lg p-6 w-96 shadow-xl border border-theme">
            <h3 class="text-lg font-bold text-primary mb-4">添加到歌单</h3>
            <div class="mb-4">
                <p class="text-sm text-secondary mb-2">选择要添加的歌单：</p>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    <div
                        v-for="playlist in myPlaylistStore.playlists"
                        :key="playlist.id"
                        @click="myPlaylistStore.handleAddToPlaylist(playlist.id)"
                        class="flex items-center gap-3 p-3 rounded-md hover:bg-hover cursor-pointer transition-colors"
                    >
                        <div class="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                            <div v-if="playlist.picUrl" class="w-full h-full">
                                <img :src="playlist.picUrl" class="w-full h-full object-cover" />
                            </div>
                            <div
                                v-else
                                class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-lg"
                            >
                                {{ playlist.isDefault ? '❤️' : '🎵' }}
                            </div>
                        </div>
                        <div class="flex-1">
                            <p class="text-primary text-sm font-medium">{{ playlist.name }}</p>
                            <p class="text-secondary text-xs">{{ playlist.trackCount }} 首歌曲</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-end">
                <button
                    class="px-4 py-2 bg-hover text-primary rounded-md hover:bg-active transition-colors"
                    @click="myPlaylistStore.closeAddToPlaylistModal()"
                >
                    取消
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.artist-detail {
    padding: 24px;
    background: var(--color-bg-secondary);
    min-height: 100vh;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400px;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top-color: #ff6b6b;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.header {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;
}

.cover {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid var(--color-border-theme);
}

.info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    min-height: 200px;
}

.line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.title {
    margin: 0;
    font-size: 28px;
    font-weight: bold;
    color: var(--color-text-primary);
}

.brief-desc {
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.6;
    max-width: 600px;
}

.meta {
    display: flex;
    gap: 16px;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.actions {
    display: flex;
    gap: 12px;
    position: absolute;
    bottom: 0;
    left: 0;
}

.btn {
    padding: 10px 20px;
    border-radius: 20px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
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

.tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--color-border-theme);
}

.tab {
    padding: 10px 20px;
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
}

.tab:hover {
    color: #333;
}

.tab.active {
    color: #ff6b6b;
    border-bottom-color: #ff6b6b;
}

.songs-tab {
    margin-top: 0;
}

.songs-table {
    width: 100%;
    border-collapse: collapse;
}

.songs-table th,
.songs-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid var(--color-border-theme);
}

.songs-table th {
    font-weight: 500;
    color: var(--color-text-secondary);
    background-color: var(--color-bg-hover);
}

.song-row {
    cursor: pointer;
}

.song-row:hover {
    background-color: var(--color-bg-hover);
}

.song-index {
    color: var(--color-text-muted);
    width: 40px;
}

.song-name {
    display: flex;
    gap: 12px;
    width: 50%;
}

.song-cover img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    object-fit: cover;
}

.song-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.song-title {
    font-weight: 500;
    color: var(--color-text-primary);
}

.song-artists {
    font-size: 13px;
    color: var(--color-text-secondary);
}

.song-album {
    color: var(--color-text-muted);
    width: 30%;
}

.song-actions {
    color: var(--color-text-muted);
    font-size: 14px;
    justify-items: center;
    width: 10%;
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
    background-color: var(--color-bg-hover);
    color: var(--color-text-primary);
}

.btn-icon.text-red-500 {
    color: var(--color-accent);
}

.btn-icon.text-red-500:hover {
    color: var(--color-accent);
}

.song-duration {
    color: var(--color-text-muted);
    font-size: 14px;
}

.albums-tab,
.mvs-tab {
    margin-top: 0;
}

.albums-grid,
.mvs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 24px;
}

.album-card,
.mv-card {
    cursor: pointer;
}

.album-cover,
.mv-cover {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 8px;
}

.album-name,
.mv-name {
    font-size: 14px;
    color: var(--color-text-primary);
    margin: 0;
    margin-bottom: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.album-meta {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 0;
}

.mv-cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

.mv-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.mv-play-count {
    position: absolute;
    top: 8px;
    right: 8px;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.mv-play-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s, background-color 0.3s;
}

.mv-card:hover .mv-play-overlay {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.3);
}

.mv-play-btn {
    width: 48px;
    height: 48px;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #000;
    transform: scale(0.8);
    transition: transform 0.3s;
}

.mv-card:hover .mv-play-btn {
    transform: scale(1);
}
</style>