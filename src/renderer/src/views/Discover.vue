<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getPlaylistCategories, getToplist, getPlaylistCatlist, type Playlist, type TopList } from '@renderer/api/playlist'
import { getNewSongs } from '@renderer/api/song'
import { getArtistList, type Artist } from '@renderer/api/artist'
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'
import { logger } from '@renderer/utils/logger'

const router = useRouter()
const playerStore = usePlayerStore()
const myPlaylistStore = useMyPlaylistStore()
const activeTab = ref('playlist')
const playlists = ref<Playlist[]>([])
const toplists = ref<TopList[]>([])
const artists = ref<Artist[]>([])
const newSongs = ref<any[]>([])
const loading = ref(true)
const showCatModal = ref(false)

const categories = ref<any>(null)
const activeCategoryType = ref('语种')
const selectedCategory = ref('全部')

const categoryTypes = ['语种', '风格', '场景', '情感', '主题']

// 歌手字母筛选
const artistInitials = [
  { key: '-1', value: '热门' },
  { key: '0', value: '#' },
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(i + 65)).map((v) => ({
    key: v,
    value: v,
  })),
]

// 歌手类型筛选
const artistTypes = [
  { key: '-1', value: '全部' },
  { key: '1', value: '男歌手' },
  { key: '2', value: '女歌手' },
  { key: '3', value: '乐队' },
]

// 歌手地区筛选
const artistAreas = [
  { key: '-1', value: '全部' },
  { key: '7', value: '华语' },
  { key: '96', value: '欧美' },
  { key: '8', value: '日本' },
  { key: '16', value: '韩国' },
  { key: '0', value: '其他' },
]

const selectedArtistType = ref('-1')
const selectedArtistArea = ref('-1')
const selectedArtistInitial = ref('-1')
const artistOffset = ref(0)
const artistHasMore = ref(true)

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlaylistClick = async (item: Playlist | TopList) => {
  try {
    await router.push(`/main/playlist/${item.id}`)
  } catch (error: any) {
    logger.error('Discover', '跳转歌单失败', error)
  }
}

const handleArtistClick = async (item: Artist) => {
  try {
    await router.push(`/main/artist/${item.id}`)
  } catch (error: any) {
    logger.error('Discover', '跳转歌手失败', error)
  }
}

const handleSongClick = (item: any) => {
  const track: Track = {
    id: item.id,
    name: item.name,
    artists: item.artists?.map((a: any) => ({ id: a.id, name: a.name })) || item.ar?.map((a: any) => ({ id: a.id, name: a.name })) || [],
    album: {
      id: item.album?.id,
      name: item.album?.name || '',
      picUrl: item.album?.picUrl?.replace(/^http:/, 'https:') || ''
    },
    duration: item.duration || item.dt || item.mMusic?.playTime || 0
  }
  playerStore.playTrack(track)
}

const handleAddToPlaylist = (item: any) => {
  const track: Track = {
    id: item.id,
    name: item.name,
    artists: item.artists?.map((a: any) => ({ id: a.id, name: a.name })) || item.ar?.map((a: any) => ({ id: a.id, name: a.name })) || [],
    album: {
      id: item.album?.id,
      name: item.album?.name || '',
      picUrl: item.album?.picUrl?.replace(/^http:/, 'https:') || ''
    },
    duration: item.duration || item.dt || item.mMusic?.playTime || 0
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

const selectCategory = (name: string) => {
  selectedCategory.value = name
  showCatModal.value = false
  loadPlaylists(true)
}

const closeCatModal = () => {
  showCatModal.value = false
}

const loadNewSongs = async () => {
  try {
    loading.value = true
    const data = await getNewSongs()
    newSongs.value = data
  } catch (error: any) {
    logger.error('Discover', '获取新歌失败', error)
  } finally {
    loading.value = false
  }
}

const newSongsHasMore = ref(false)
const newSongsOffset = ref(0)

const loadMoreNewSongs = async () => {
  try {
    newSongsOffset.value += 200
    const data = await getNewSongs(newSongsOffset.value)
    if (data.length > 0) {
      newSongs.value = [...newSongs.value, ...data]
    } else {
      newSongsHasMore.value = false
    }
  } catch (error: any) {
    logger.error('Discover', '加载更多新歌失败', error)
  }
}

// 歌单相关
const playlistOffset = ref(0)
const playlistHasMore = ref(true)

const loadPlaylists = async (reset = true) => {
  try {
    if (reset) {
      loading.value = true
      playlistOffset.value = 0
      playlistHasMore.value = true
    }
    const data = await getPlaylistCategories(selectedCategory.value, 30, playlistOffset.value)
    if (data.length > 0) {
      if (reset) {
        playlists.value = data
      } else {
        playlists.value = [...playlists.value, ...data]
      }
      playlistOffset.value += 30
      if (data.length < 30) {
        playlistHasMore.value = false
      }
    } else {
      playlistHasMore.value = false
    }
  } catch (error: any) {
    logger.error('Discover', '获取推荐歌单失败', error)
  } finally {
    if (reset) {
      loading.value = false
    }
  }
}

const loadMorePlaylists = () => {
  if (!playlistHasMore.value) return
  loadPlaylists(false)
}

const loadToplists = async () => {
  try {
    const data = await getToplist()
    toplists.value = data || []
  } catch (error: any) {
    logger.error('Discover', '获取排行榜失败', error)
  }
}

const loadCategories = async () => {
  try {
    const data = await getPlaylistCatlist()
    categories.value = data
  } catch (error: any) {
    logger.error('Discover', '获取分类失败', error)
  }
}

const loadArtists = async (reset = true) => {
  try {
    if (reset) {
      artistOffset.value = 0
      artistHasMore.value = true
    }
    const data = await getArtistList(
      Number(selectedArtistType.value),
      Number(selectedArtistArea.value),
      selectedArtistInitial.value,
      50,
      artistOffset.value
    )
    if (data.length > 0) {
      if (reset) {
        artists.value = data
      } else {
        artists.value = [...artists.value, ...data]
      }
      artistOffset.value += 50
      if (data.length < 50) {
        artistHasMore.value = false
      }
    } else {
      artistHasMore.value = false
    }
  } catch (error: any) {
    logger.error('Discover', '获取歌手列表失败', error)
  }
}

const loadMoreArtists = () => {
  if (!artistHasMore.value) return
  loadArtists(false)
}

const selectArtistType = (type: string) => {
  selectedArtistType.value = type
  loadArtists(true)
}

const selectArtistArea = (area: string) => {
  selectedArtistArea.value = area
  loadArtists(true)
}

const selectArtistInitial = (initial: string) => {
  selectedArtistInitial.value = initial
  loadArtists(true)
}

watch(activeTab, (newTab) => {
  if (newTab === 'playlist') {
    loadPlaylists()
  } else if (newTab === 'toplist') {
    loadToplists()
  } else if (newTab === 'artist') {
    loadArtists()
  } else if (newTab === 'newsong') {
    loadNewSongs()
  }
})

onMounted(() => {
  loadPlaylists()
  loadToplists()
  loadCategories()
})

onUnmounted(() => {
})
</script>

<template>
  <div class="h-full flex flex-col bg-secondary select-none">
    <!-- 页面头部 -->
    <div class="px-8 pt-6">
      <div class="flex items-center gap-4 mb-6">
        <button
          v-for="tab in ['playlist', 'toplist', 'artist', 'newsong']"
          :key="tab"
          @click="activeTab = tab"
          :class="[
            'px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer',
            activeTab === tab
              ? 'bg-selected text-on-primary'
              : 'bg-hover text-primary hover:bg-active'
          ]"
        >
          {{ tab === 'playlist' ? '推荐歌单' : tab === 'toplist' ? '排行榜' : tab === 'artist' ? '歌手' : '最新音乐' }}
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto px-8 pb-6">
      <!-- 推荐歌单 -->
      <div v-if="activeTab === 'playlist'">
        <div v-if="loading" class="flex items-center justify-center h-64">
          <div class="text-gray-400">加载中...</div>
        </div>

        <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          <div
            v-for="item in playlists"
            :key="item.id"
            class="playlist-card group cursor-pointer"
            @click="handlePlaylistClick(item)"
          >
            <div class="relative w-full aspect-square rounded-xl mb-3 overflow-hidden">
              <img
                :src="item.picUrl?.replace(/^http:/, 'https:')"
                :alt="item.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <span>▶</span>
                <span>{{ (item.playCount || 0) >= 10000 ? ((item.playCount || 0) / 10000).toFixed(1) + '万' : item.playCount }}</span>
              </div>
            </div>
            <h3 class="text-primary font-medium text-sm leading-snug line-clamp-2">{{ item.name }}</h3>
          </div>
        </div>
        <div v-if="!loading && playlistHasMore" class="flex justify-center mt-10">
          <button
            @click="loadMorePlaylists"
            class="px-8 py-3 bg-hover text-primary rounded-full hover:bg-active transition-all hover:scale-105 activate:scale-95 cursor-pointer"
          >
            加载更多
          </button>
        </div>
      </div>

      <!-- 排行榜 -->
      <div v-if="activeTab === 'toplist'">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-5">
          <div
            v-for="item in toplists"
            :key="item.id"
            class="group hover:scale-105 active:scale-95 duration:300 cursor-pointer"
            @click="handlePlaylistClick(item)"
          >
            <div class="relative w-full aspect-[3/2] rounded-xl mb-3 overflow-hidden">
              <img
                :src="item.coverImgUrl?.replace(/^http:/, 'https:')"
                :alt="item.name"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div class="absolute bottom-3 left-3 right-3">
                <h3 class="text-white font-bold text-lg">{{ item.name }}</h3>
                <p class="text-white/70 text-sm">{{ item.updateFrequency || '' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 歌手 -->
      <div v-if="activeTab === 'artist'">
        <!-- 字母筛选 -->
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          <button
            v-for="item in artistInitials"
            :key="item.key"
            @click="selectArtistInitial(item.key)"
            :class="[
              'px-3 py-1 rounded-full text-sm transition-colors cursor-pointer',
              selectedArtistInitial === item.key
                ? 'bg-selected text-on-primary'
                : 'bg-hover text-primary hover:bg-active'
            ]"
          >
            {{ item.value }}
          </button>
        </div>
        
        <!-- 地区筛选 -->
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          <button
            v-for="item in artistAreas"
            :key="item.key"
            @click="selectArtistArea(item.key)"
            :class="[
              'px-3 py-1 rounded-full text-sm transition-colors cursor-pointer',
              selectedArtistArea === item.key
                ? 'bg-selected text-on-primary'
                : 'bg-hover text-primary hover:bg-active'
            ]"
          >
            {{ item.value }}
          </button>
        </div>
        
        <!-- 类型筛选 -->
        <div class="flex items-center gap-2 mb-6 flex-wrap">
          <button
            v-for="item in artistTypes"
            :key="item.key"
            @click="selectArtistType(item.key)"
            :class="[
              'px-3 py-1 rounded-full text-sm transition-colors cursor-pointer',
              selectedArtistType === item.key
                ? 'bg-selected text-on-primary'
                : 'bg-hover text-primary hover:bg-active'
            ]"
          >
            {{ item.value }}
          </button>
        </div>

        <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          <div
            v-for="item in artists"
            :key="item.id"
            class="flex flex-col items-center cursor-pointer hover:scale-105 active:scale-95 duration-300"
            @click="handleArtistClick(item)"
          >
            <div class="w-24 h-24 rounded-full overflow-hidden mb-2">
              <img
                :src="item.picUrl?.replace(/^http:/, 'https:')"
                :alt="item.name"
                class="w-full h-full object-cover group-hover:scale-110 transition-all duration-300"
              />
            </div>
            <span class="text-primary text-sm truncate max-w-full text-center">{{ item.name }}</span>
          </div>
        </div>
        <div v-if="artistHasMore" class="flex justify-center mt-10">
          <button
            @click="loadMoreArtists"
            class="px-8 py-3 bg-hover text-primary rounded-full hover:bg-active transition-all hover:scale-105 activate:scale-95 cursor-pointer"
          >
            加载更多
          </button>
        </div>
      </div>

      <!-- 最新音乐 -->
      <div v-if="activeTab === 'newsong'">
        <div v-if="loading" class="flex items-center justify-center h-64">
          <div class="text-gray-400">加载中...</div>
        </div>

        <table v-else class="track-table w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>标题</th>
              <th>专辑</th>
              <th class="text-center">操作</th>
              <th>时长</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in newSongs.slice(0, 200)"
              :key="item.id"
              class="track-row transition-all duration-200 hover:scale-105"
            >
              <td class="track-index">{{ index + 1 }}</td>
              <td class="track-name">
                <div class="track-cover">
                  <img
                    v-if="item.album?.picUrl"
                    :src="item.album.picUrl?.replace(/^http:/, 'https:')"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full bg-gray-100 flex items-center justify-center text-lg">🎵</div>
                </div>
                <div class="track-info">
                  <span class="track-title">{{ item.name }}</span>
                  <span class="track-artists">{{ item.artists?.map((a: any) => a.name).join(' / ') || '' }}</span>
                </div>
              </td>
              <td class="track-album">{{ item.album?.name || '' }}</td>
              <td class="track-actions">
                <button class="btn-icon" @click="handleSongClick(item)">
                  <img :src="PlayIcon" class="w-4 h-4" />
                </button>
                <button
                  class="btn-icon"
                  :class="{ 'text-red-500': isInAnyPlaylist(item.id) }"
                  @click="handleAddToPlaylist(item)"
                >
                  <img 
                    :src="isInAnyPlaylist(item.id) ? LikeIcon : LikeNoIcon" 
                    class="w-4 h-4" 
                  />
                </button>
              </td>
              <td class="track-duration">{{ formatDuration(item.duration || item.dt || item.mMusic?.playTime || 0) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="newSongsHasMore" class="flex justify-center mt-10">
          <button
            @click="loadMoreNewSongs"
            class="px-8 py-3 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-all hover:scale-105 activate:scale-95 cursor-pointer"
          >
            加载更多
          </button>
        </div>
      </div>

      <!-- 分类弹窗 -->
      <div
        v-if="showCatModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="closeCatModal"
      >
        <div class="bg-secondary rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-xl border border-theme">
          <div class="flex items-center justify-between p-4 border-b border-theme">
            <div class="flex items-center gap-2">
              <span class="text-primary font-medium">歌单分类</span>
              <span
                @click="selectCategory('全部')"
                :class="[
                  'px-3 py-1 text-sm rounded-full cursor-pointer transition-colors',
                  selectedCategory === '全部'
                    ? 'bg-selected text-on-primary'
                    : 'bg-hover text-primary hover:bg-active'
                ]"
              >
                全部歌单
              </span>
            </div>
            <button
              @click="closeCatModal"
              class="text-secondary hover:text-primary text-xl leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          <div class="p-4">
            <div class="flex items-center gap-2 mb-4">
              <button
                v-for="type in categoryTypes"
                :key="type"
                @click="activeCategoryType = type"
                :class="[
                  'px-4 py-2 text-sm rounded-lg transition-colors',
                  activeCategoryType === type
                    ? 'bg-primary text-white'
                    : 'bg-hover text-primary hover:bg-active'
                ]"
              >
                {{ type }}
              </button>
            </div>

            <div class="flex flex-wrap gap-2">
              <span
                v-for="item in (categories?.categories || []).filter((c: any) => c.category === activeCategoryType)"
                :key="item.name"
                @click="selectCategory(item.name)"
                :class="[
                  'px-4 py-2 text-sm rounded-full cursor-pointer transition-colors',
                  selectedCategory === item.name
                    ? 'bg-primary text-white'
                    : 'bg-hover text-primary hover:bg-active'
                ]"
              >
                {{ item.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加到歌单弹窗 -->
    <div v-if="myPlaylistStore.showAddToPlaylistModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="myPlaylistStore.closeAddToPlaylistModal()">
      <div class="bg-secondary rounded-xl p-6 w-96 shadow-xl border border-theme">
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
                <p class="text-secondary text-xs">{{ playlist.trackCount }} 首歌曲</p>
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end">
          <button 
            class="px-4 py-2 bg-hover text-primary rounded-lg hover:bg-active transition-colors"
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
}

.track-artists {
  font-size: 12px;
  color: var(--color-text-muted);
}

.track-album {
  color: var(--color-text-muted);
  font-size: 14px;
  width: 30%;
}

.track-actions {
  color: var(--color-text-muted);
  font-size: 14px;
  display: flex;
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
  color: var(--color-text-primary);
}

.track-duration {
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>