<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useFavoriteStore, type FavoritePlaylist } from '@renderer/stores/favorites'

const router = useRouter()
const favoriteStore = useFavoriteStore()

const playlists = computed(() => favoriteStore.favoritePlaylists)
const isLoading = computed(() => false)
const editMode = ref(false)
const selectedIds = ref<Set<number>>(new Set())

const toggleSelect = (id: number) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const selectAll = () => {
  if (selectedIds.value.size === playlists.value.length) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(playlists.value.map(p => p.id))
  }
}

const batchUnfavorite = () => {
  if (selectedIds.value.size === 0) return
  if (!confirm(`确定要取消收藏 ${selectedIds.value.size} 个歌单吗？`)) return
  
  selectedIds.value.forEach(id => {
    favoriteStore.removeFavorite(id)
  })
  selectedIds.value.clear()
  editMode.value = false
}

const exitEditMode = () => {
  editMode.value = false
  selectedIds.value.clear()
}

const formatPlayCount = (count: number) => {
  if (count >= 100000000) {
    return (count / 100000000).toFixed(1) + '亿'
  } else if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return count.toString()
}

const handlePlaylistClick = async (playlist: FavoritePlaylist) => {
  try {
    await router.push(`/main/playlist/${playlist.id}`)
  } catch (error) {
    console.error('跳转失败:', error)
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-secondary">
    <!-- 页面头部 -->
    <div class="px-8 pt-6">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-end gap-3">
          <h1 class="text-2xl font-bold text-primary">收藏歌单</h1>
          <span class="text-secondary text-sm">共 {{ playlists.length }} 个</span>
        </div>
        <div class="flex items-center gap-3">
          <template v-if="!editMode">
            <button 
              v-if="playlists.length > 0"
              class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
              @click="editMode = true"
            >
              批量管理
            </button>
          </template>
          <template v-else>
            <button 
              class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
              @click="exitEditMode"
            >
              取消
            </button>
            <button 
              class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
              @click="selectAll"
            >
              {{ selectedIds.size === playlists.length ? '取消全选' : '选择全部' }}
            </button>
            <button 
              class="px-6 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="selectedIds.size === 0"
              @click="batchUnfavorite"
            >
              取消收藏 ({{ selectedIds.size }})
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 歌单列表 -->
    <div class="flex-1 overflow-y-auto px-8 pb-6">
      <div v-if="isLoading" class="flex items-center justify-center h-64">
        <div class="text-gray-400">加载中...</div>
      </div>

      <div v-else-if="playlists.length === 0" class="flex flex-col items-center justify-center h-96 text-gray-500">
        <span class="text-6xl mb-4">❤️</span>
        <span class="text-xl">暂无收藏歌单</span>
      </div>

      <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        <div
          v-for="item in playlists"
          :key="item.id"
          class="playlist-card group"
          :class="{ 'cursor-pointer': !editMode }"
          @click="editMode ? toggleSelect(item.id) : handlePlaylistClick(item)"
        >
          <div class="relative w-full aspect-square rounded-xl mb-3 overflow-hidden">
            <!-- 选择框 -->
            <div v-if="editMode" class="absolute top-2 left-2 z-10">
              <div 
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
                :class="selectedIds.has(item.id) ? 'bg-red-500 border-red-500' : 'bg-white/80 border-gray-300'"
              >
                <span v-if="selectedIds.has(item.id)" class="text-white text-xs">✓</span>
              </div>
            </div>
            <img
              v-if="item.picUrl"
              :src="item.picUrl"
              :alt="item.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div v-else class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-4xl">
              🎵
            </div>
            <div v-if="item.playCount" class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <span>▶</span>
              <span>{{ formatPlayCount(item.playCount) }}</span>
            </div>
          </div>
          <h3 class="text-gray-800 font-medium text-sm leading-snug line-clamp-2">{{ item.name }}</h3>
          <p class="text-gray-400 text-xs mt-1">{{ item.trackCount }} 首歌曲</p>
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
</style>