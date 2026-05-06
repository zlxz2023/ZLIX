<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cloudSearch, processImageUrl, type SearchSong, type SearchAlbum, type SearchArtist, type SearchPlaylist, type SearchMv } from '@renderer/api/song'
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import VideoPlayer from '@renderer/components/VideoPlayer.vue'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const myPlaylistStore = useMyPlaylistStore()

const activeTab = ref('song')  // song / album / artist / playlist / mv
const searchResults = ref<{
  songs?: SearchSong[]
  albums?: SearchAlbum[]
  artists?: SearchArtist[]
  playlists?: SearchPlaylist[]
  mvs?: SearchMv[]
  songCount?: number
  albumCount?: number
  artistCount?: number
  playlistCount?: number
  mvCount?: number
}>({})
const loading = ref(false)
const searchKeyword = ref('')
const offset = ref(0)
const hasMore = ref(true)
const limit = 30

const tabs = [
  { key: 'song', label: '单曲' },
  { key: 'album', label: '专辑' },
  { key: 'artist', label: '歌手' },
  { key: 'playlist', label: '歌单' },
  { key: 'mv', label: 'MV' }
]

const typeMap: Record<string, number> = {
  song: 1,
  album: 10,
  artist: 100,
  playlist: 1000,
  mv: 1004
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatPlayCount = (count: number): string => {
  if (count >= 100000000) {
    return `${(count / 100000000).toFixed(1)}亿`
  } else if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  return count.toString()
}

const truncateArtistName = (name: string, maxLength: number = 20): string => {
  if (!name) return ''
  if (name.length <= maxLength) return name
  return name.slice(0, maxLength) + '...'
}

const doSearch = async (keyword: string, type: number, isLoadMore: boolean = false) => {
  if (!keyword.trim()) {
    searchResults.value = {}
    return
  }
  
  if (!isLoadMore) {
    loading.value = true
  }
  try {
    const data = await cloudSearch(keyword, type, offset.value, limit)
    if (data.code === 200 && data.result) {
      if (isLoadMore) {
        if (data.result.songs?.length) {
          searchResults.value.songs = [...(searchResults.value.songs || []), ...data.result.songs]
        }
        if (data.result.albums?.length) {
          searchResults.value.albums = [...(searchResults.value.albums || []), ...data.result.albums]
        }
        if (data.result.artists?.length) {
          searchResults.value.artists = [...(searchResults.value.artists || []), ...data.result.artists]
        }
        if (data.result.playlists?.length) {
          searchResults.value.playlists = [...(searchResults.value.playlists || []), ...data.result.playlists]
        }
        if (data.result.mvs?.length) {
          searchResults.value.mvs = [...(searchResults.value.mvs || []), ...data.result.mvs]
        }
      } else {
        searchResults.value = {
          songs: data.result.songs,
          albums: data.result.albums,
          artists: data.result.artists,
          playlists: data.result.playlists,
          mvs: data.result.mvs,
          songCount: data.result.songCount,
          albumCount: data.result.albumCount,
          artistCount: data.result.artistCount,
          playlistCount: data.result.playlistCount,
          mvCount: data.result.mvCount
        }
      }
      const currentResult = getCurrentResult()
      hasMore.value = !!(currentResult && currentResult.length >= limit)
    } else {
      if (!isLoadMore) {
        searchResults.value = {}
      }
      hasMore.value = false
    }
  } catch (error) {
    console.error('搜索失败:', error)
    if (!isLoadMore) {
      searchResults.value = {}
    }
    hasMore.value = false
  } finally {
    if (!isLoadMore) {
      loading.value = false
    }
  }
}

const getCurrentResult = (): any[] | undefined => {
  switch (activeTab.value) {
    case 'song': return searchResults.value.songs
    case 'album': return searchResults.value.albums
    case 'artist': return searchResults.value.artists
    case 'playlist': return searchResults.value.playlists
    case 'mv': return searchResults.value.mvs
    default: return undefined
  }
}

const loadMore = () => {
  if (!hasMore.value || loading.value) return
  offset.value += limit
  doSearch(searchKeyword.value, typeMap[activeTab.value], true)
}

const handlePlaySong = async (song: SearchSong) => {
  const track: Track = {
    id: song.id,
    name: song.name,
    artists: song.ar,
    album: {
      id: song.al.id,
      name: song.al.name,
      picUrl: processImageUrl(song.al.picUrl, 300)
    },
    duration: song.dt
  }
  await playerStore.playTrack(track)
}

const handleAddToPlaylist = (song: SearchSong) => {
  const track: Track = {
    id: song.id,
    name: song.name,
    artists: song.ar,
    album: {
      id: song.al.id,
      name: song.al.name,
      picUrl: processImageUrl(song.al.picUrl, 300)
    },
    duration: song.dt
  }
  
  const playlistsWithTrack = myPlaylistStore.getPlaylistsContainingTrack(track.id)
  if (playlistsWithTrack.length > 0) {
    // 歌曲已在歌单中，从所有歌单中删除
    for (const playlist of playlistsWithTrack) {
      myPlaylistStore.removeTrackFromPlaylist(playlist.id, track.id)
    }
  } else {
    // 歌曲不在歌单中，弹窗让用户选择
    myPlaylistStore.openAddToPlaylistModal(track)
  }
}

const isInAnyPlaylist = (trackId: number | string) => {
  return myPlaylistStore.getPlaylistsContainingTrack(trackId).length > 0
}

const handleAlbumClick = (album: SearchAlbum) => {
  router.push(`/main/album/${album.id}`)
}

const handleArtistClick = (artist: SearchArtist) => {
  router.push(`/main/artist/${artist.id}`)
}

const handlePlaylistClick = (playlist: SearchPlaylist) => {
  router.push(`/main/playlist/${playlist.id}`)
}

const showVideoPlayer = ref(false)
const currentVideoUrl = ref('')
const currentVideoTitle = ref('')

const handleMvClick = async (mv: SearchMv) => {
  try {
    const { getMvUrl } = await import('@renderer/api/mv')
    const url = await getMvUrl(mv.id)
    if (url) {
      currentVideoUrl.value = url
      currentVideoTitle.value = mv.name
      showVideoPlayer.value = true
    }
  } catch (error) {
    console.error('获取MV播放地址失败:', error)
  }
}

onMounted(() => {
  searchKeyword.value = (route.query.keyword as string) || ''
  if (searchKeyword.value) {
    offset.value = 0
    hasMore.value = true
    doSearch(searchKeyword.value, typeMap[activeTab.value])
  }
})

watch(
  () => route.query.keyword,
  (newKeyword) => {
    searchKeyword.value = (newKeyword as string) || ''
    if (searchKeyword.value) {
      offset.value = 0
      hasMore.value = true
      doSearch(searchKeyword.value, typeMap[activeTab.value])
    }
  }
)

watch(activeTab, (newTab) => {
  if (searchKeyword.value) {
    offset.value = 0
    hasMore.value = true
    doSearch(searchKeyword.value, typeMap[newTab])
  }
})
</script>

<template>
  <div class="search-page p-8">
    <h2 class="text-2xl font-bold text-primary mb-6">
      {{ searchKeyword ? `"${searchKeyword}" 的搜索结果` : '搜索' }}
    </h2>

    <!-- 搜索Tab -->
    <div class="flex gap-6 border-b border-theme mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'pb-3 text-sm font-medium transition-colors cursor-pointer',
          activeTab === tab.key
            ? 'text-primary border-b-2 border-accent'
            : 'text-muted hover:text-secondary'
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-2 border-gray-200 border-t-gray-800 rounded-full animate-spin"></div>
    </div>

    <!-- 无结果 -->
    <div
      v-else-if="
        (activeTab === 'song' && !searchResults.songs?.length) ||
        (activeTab === 'album' && !searchResults.albums?.length) ||
        (activeTab === 'artist' && !searchResults.artists?.length) ||
        (activeTab === 'playlist' && !searchResults.playlists?.length) ||
        (activeTab === 'mv' && !searchResults.mvs?.length)
      "
      class="flex flex-col items-center justify-center py-20 text-muted"
    >
      <span class="text-4xl mb-3">🔍</span>
      <p>暂无搜索结果</p>
    </div>

    <!-- 单曲列表 -->
    <div v-else-if="activeTab === 'song'">
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
            v-for="(song, index) in searchResults.songs"
            :key="song.id"
            class="track-row transition-all duration-200 hover:scale-105"
          >
            <td class="track-index">{{ index + 1 }}</td>
            <td class="track-name">
              <div class="track-cover">
                <img
                  :src="processImageUrl(song.al.picUrl, 100)"
                  :alt="song.al.name"
                />
              </div>
              <div class="track-info">
                <span class="track-title">{{ song.name }}</span>
                <span class="track-artists">{{ truncateArtistName(song.ar.map(a => a.name).join(' / ')) }}</span>
              </div>
            </td>
            <td class="track-album">{{ song.al.name }}</td>
            <td class="track-actions">
              <button class="btn-icon" @click.stop="handlePlaySong(song)">
                <img :src="PlayIcon" class="w-4 h-4" />
              </button>
              <button
                class="btn-icon"
                :class="{ 'text-red-500': isInAnyPlaylist(song.id) }"
                @click.stop="handleAddToPlaylist(song)"
              >
                <img :src="isInAnyPlaylist(song.id) ? LikeIcon : LikeNoIcon" class="w-4 h-4" />
              </button>
            </td>
            <td class="track-duration">{{ formatDuration(song.dt) }}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- 加载更多按钮 -->
      <div class="load-more-container">
        <button
          type="button"
          class="load-more-btn"
          :disabled="loading"
          @click="loadMore"
        >
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- 专辑列表 -->
    <div v-else-if="activeTab === 'album'">
      <div class="albums-grid">
        <div
          v-for="album in searchResults.albums"
          :key="album.id"
          class="album-card cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
          @click="handleAlbumClick(album)"
        >
          <img
            :src="processImageUrl(album.picUrl, 300)"
            :alt="album.name"
            class="album-cover"
          />
          <h3 class="album-name">{{ album.name }}</h3>
          <p class="album-meta">{{ album.artist.name }}</p>
        </div>
      </div>
      
      <!-- 加载更多按钮 -->
      <div class="load-more-container">
        <button
          type="button"
          class="load-more-btn"
          :disabled="loading"
          @click="loadMore"
        >
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
    </div>

    <!-- 歌手列表 -->
    <div v-else-if="activeTab === 'artist'" class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
      <div
        v-for="artist in searchResults.artists"
        :key="artist.id"
        class="flex flex-col items-center cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
        @click="handleArtistClick(artist)"
      >
        <div class="w-24 h-24 rounded-full overflow-hidden mb-2 duration-200 active:scale-95 hover:scale-105">
          <img
            :src="artist.img1v1Url"
            :alt="artist.name"
            class="w-full h-full object-cover"
          />
        </div>
        <span class="text-primary text-sm truncate text-center">{{ artist.name }}</span>
      </div>
    </div>
    
    <!-- 加载更多按钮 -->
    <div v-if="activeTab === 'artist' && hasMore" class="load-more-container">
      <button
        type="button"
        class="load-more-btn"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <!-- 歌单列表 -->
    <div v-else-if="activeTab === 'playlist'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      <div
        v-for="playlist in searchResults.playlists"
        :key="playlist.id"
        class="cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
        @click="handlePlaylistClick(playlist)"
      >
        <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3">
          <img
            :src="processImageUrl(playlist.coverImgUrl, 300)"
            :alt="playlist.name"
            class="w-full h-full object-cover"
          />
          <div class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <span>▶</span>
            <span>{{ formatPlayCount(playlist.playCount || 0) }}</span>
          </div>
        </div>
        <h3 class="text-primary text-sm font-medium line-clamp-2">{{ playlist.name }}</h3>
        <p class="text-muted text-xs">{{ playlist.trackCount || 0 }} 首歌曲</p>
      </div>
    </div>
    
    <!-- 加载更多按钮 -->
    <div v-if="activeTab === 'playlist' && hasMore" class="load-more-container">
      <button
        type="button"
        class="load-more-btn"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <!-- MV列表 -->
    <div v-else-if="activeTab === 'mv'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      <div
        v-for="mv in searchResults.mvs"
        :key="mv.id"
        class="mv-card cursor-pointer transition-all duration-200 active:scale-95 hover:scale-105"
        @click="handleMvClick(mv)"
      >
        <div class="mv-cover-wrapper">
          <img
            :src="processImageUrl(mv.cover, 300)"
            :alt="mv.name"
            class="mv-cover"
          />
          <div class="mv-play-count" v-if="mv.playCount">
            <span>▶</span>
            <span>{{ formatPlayCount(mv.playCount) }}</span>
          </div>
          <div class="mv-play-overlay">
            <div class="mv-play-btn">
              <img :src="PlayIcon" class="w-4 h-4 transform translate-x-0.5" />
            </div>
          </div>
        </div>
        <h3 class="text-primary text-sm font-medium truncate">{{ mv.name }}</h3>
        <p class="text-muted text-xs">{{ mv.artistName }} · {{ formatDuration(mv.duration || 0) }}</p>
      </div>
    </div>
    
    <!-- 加载更多按钮 -->
    <div v-if="activeTab === 'mv' && hasMore" class="load-more-container">
      <button
        type="button"
        class="load-more-btn"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? '加载中...' : '加载更多' }}
      </button>
    </div>

    <!-- 视频播放器 -->
    <VideoPlayer
      :visible="showVideoPlayer"
      :video-url="currentVideoUrl"
      :title="currentVideoTitle"
      @close="showVideoPlayer = false"
    />

    <!-- 添加到歌单弹窗 -->
    <div v-if="myPlaylistStore.showAddToPlaylistModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="myPlaylistStore.closeAddToPlaylistModal()">
      <div class="bg-secondary rounded-xl p-6 w-96 shadow-xl">
        <h2 class="text-xl font-bold text-primary mb-4">添加到歌单</h2>
        <div class="mb-4">
          <p class="text-secondary text-sm mb-2">选择要添加的歌单：</p>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="playlist in myPlaylistStore.playlists"
              :key="playlist.id"
              @click="myPlaylistStore.handleAddToPlaylist(playlist.id)"
              class="flex items-center gap-3 p-3 rounded-lg hover:bg-hover cursor-pointer transition-colors"
            >
              <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                <div v-if="playlist.picUrl" class="w-full h-full">
                  <img :src="playlist.picUrl" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-lg">
                  {{ playlist.isDefault ? '❤️' : '🎵' }}
                </div>
              </div>
              <div class="flex-1">
                <p class="text-primary text-sm font-medium">{{ playlist.name }}</p>
                <p class="text-muted text-xs">{{ playlist.trackCount }} 首歌曲</p>
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end">
          <button 
            class="px-4 py-2 bg-hover text-primary rounded-lg hover:bg-theme transition-colors"
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

.track-row {
  cursor: pointer;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artists {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.albums-grid, .mvs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 24px;
}

.album-card, .mv-card {
  cursor: pointer;
}

.album-cover, .mv-cover {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 8px;
}

.album-name, .mv-name {
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
  color: var(--color-text-muted);
  margin: 0;
}

.track-duration {
  color: var(--color-text-muted);
  font-size: 14px;
}

.mv-card {
  cursor: pointer;
}

.mv-cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
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

.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  clear: both;
}

.load-more-btn {
  padding: 12px 32px;
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  transform: scale(1);
}

.load-more-btn:hover:not(:disabled) {
  background-color: var(--color-text-muted);
  color: var(--color-bg-primary);
  transform: scale(1.05);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>