import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Track } from './player'

export interface MyPlaylist {
  id: string
  name: string
  picUrl?: string
  playCount: number
  trackCount: number
  isDefault?: boolean
  tracks?: Track[]
}

export const useMyPlaylistStore = defineStore('myPlaylists', () => {
  const playlists = ref<MyPlaylist[]>([
    {
      id: 'local_default',
      name: '我喜欢的音乐',
      picUrl: '',
      playCount: 0,
      trackCount: 0,
      isDefault: true,
      tracks: []
    }
  ])

  const showCreateModal = ref(false)
  const newPlaylistName = ref('')
  
  const showAddToPlaylistModal = ref(false)
  const trackToAdd = ref<Track | null>(null)

  let nextId = 1

  const openCreateModal = () => {
    newPlaylistName.value = ''
    showCreateModal.value = true
  }

  const closeCreateModal = () => {
    showCreateModal.value = false
    newPlaylistName.value = ''
  }

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.value.trim()
    if (!name) {
      alert('请输入歌单名称')
      return
    }
    const exists = playlists.value.some(p => p.name === name)
    if (exists) {
      alert('歌单名称已存在')
      return
    }
    const newPlaylist: MyPlaylist = {
      id: `local_${nextId++}`,
      name: name,
      picUrl: '',
      playCount: 0,
      trackCount: 0,
      isDefault: false,
      tracks: []
    }
    playlists.value.unshift(newPlaylist)
    closeCreateModal()
  }

  const createPlaylist = (name: string, picUrl?: string) => {
    const exists = playlists.value.some(p => p.name === name)
    if (exists) {
      return null
    }
    const newPlaylist: MyPlaylist = {
      id: `local_${nextId++}`,
      name: name || '新建歌单',
      picUrl: picUrl || '',
      playCount: 0,
      trackCount: 0,
      isDefault: false,
      tracks: []
    }
    playlists.value.unshift(newPlaylist)
    return newPlaylist
  }

  const deletePlaylist = (id: string) => {
    const index = playlists.value.findIndex(p => p.id === id)
    if (index !== -1 && !playlists.value[index].isDefault) {
      playlists.value.splice(index, 1)
      return true
    }
    return false
  }

  const batchDelete = (ids: string[]) => {
    const toDelete = ids.filter(id => {
      const playlist = playlists.value.find(p => p.id === id)
      return playlist && !playlist.isDefault
    })
    playlists.value = playlists.value.filter(p => !toDelete.includes(p.id))
    return toDelete.length
  }

  const updatePlaylist = (id: string, updates: Partial<MyPlaylist>) => {
    const playlist = playlists.value.find(p => p.id === id)
    if (playlist) {
      Object.assign(playlist, updates)
    }
  }

  const addTrackToPlaylist = (playlistId: string, track: Track) => {
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist) {
      if (!playlist.tracks) {
        playlist.tracks = []
      }
      const exists = playlist.tracks.some(t => t.id === track.id)
      if (!exists) {
        playlist.tracks.push(track)
        playlist.trackCount = playlist.tracks.length
        return true
      }
    }
    return false
  }

  const removeTrackFromPlaylist = (playlistId: string, trackId: number | string) => {
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist && playlist.tracks) {
      const index = playlist.tracks.findIndex(t => t.id === trackId)
      if (index !== -1) {
        playlist.tracks.splice(index, 1)
        playlist.trackCount = playlist.tracks.length
        return true
      }
    }
    return false
  }

  const isInDefaultPlaylist = (trackId: number | string) => {
    const defaultPlaylist = playlists.value.find(p => p.isDefault)
    if (defaultPlaylist && defaultPlaylist.tracks) {
      return defaultPlaylist.tracks.some(t => t.id === trackId)
    }
    return false
  }

  const toggleTrackInDefaultPlaylist = (track: Track) => {
    const defaultPlaylist = playlists.value.find(p => p.isDefault)
    if (!defaultPlaylist) return false

    if (isInDefaultPlaylist(track.id)) {
      return removeTrackFromPlaylist(defaultPlaylist.id, track.id)
    } else {
      return addTrackToPlaylist(defaultPlaylist.id, track)
    }
  }

  const getPlaylistsContainingTrack = (trackId: number | string) => {
    return playlists.value.filter(p => 
      p.tracks && p.tracks.some(t => t.id === trackId)
    )
  }

  const openAddToPlaylistModal = (track: Track) => {
    trackToAdd.value = track
    showAddToPlaylistModal.value = true
  }

  const closeAddToPlaylistModal = () => {
    showAddToPlaylistModal.value = false
    trackToAdd.value = null
  }

  const handleAddToPlaylist = (playlistId: string) => {
    if (!trackToAdd.value) return
    const success = addTrackToPlaylist(playlistId, trackToAdd.value)
    if (success) {
      alert('已添加到歌单')
    } else {
      alert('歌曲已在该歌单中')
    }
    closeAddToPlaylistModal()
  }

  return {
    playlists,
    showCreateModal,
    newPlaylistName,
    showAddToPlaylistModal,
    trackToAdd,
    openCreateModal,
    closeCreateModal,
    handleCreatePlaylist,
    createPlaylist,
    deletePlaylist,
    batchDelete,
    updatePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    isInDefaultPlaylist,
    toggleTrackInDefaultPlaylist,
    getPlaylistsContainingTrack,
    openAddToPlaylistModal,
    closeAddToPlaylistModal,
    handleAddToPlaylist
  }
}, {
    persist: {
        key: 'my-playlists',
        storage: localStorage,
        pick: ['playlists']
    }
})