import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FavoritePlaylist {
  id: number
  name: string
  picUrl?: string
  playCount: number
  trackCount: number
  description?: string
  creator?: {
    nickname: string
  }
}

export const useFavoriteStore = defineStore('favorites', () => {
  const favoritePlaylists = ref<FavoritePlaylist[]>([])

  const isFavorite = (id: number): boolean => {
    return favoritePlaylists.value.some(p => p.id === id)
  }

  const toggleFavorite = (playlist: FavoritePlaylist) => {
    const index = favoritePlaylists.value.findIndex(p => p.id === playlist.id)
    if (index === -1) {
      favoritePlaylists.value.unshift(playlist)
    } else {
      favoritePlaylists.value.splice(index, 1)
    }
  }

  const removeFavorite = (id: number) => {
    const index = favoritePlaylists.value.findIndex(p => p.id === id)
    if (index !== -1) {
      favoritePlaylists.value.splice(index, 1)
    }
  }

  return {
    favoritePlaylists,
    isFavorite,
    toggleFavorite,
    removeFavorite
  }
}, {
    persist: {
        key: 'favorites',
        storage: localStorage,
        pick: ['favoritePlaylists']
    }
})