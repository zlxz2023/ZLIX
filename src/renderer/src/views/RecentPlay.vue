<script setup lang="ts">
import { usePlayerStore, type Track } from '@renderer/stores/player'
import { useMyPlaylistStore } from '@renderer/stores/myPlaylists'
import PlayIcon from '@renderer/assets/icons/player/play.svg'
import LikeIcon from '@renderer/assets/icons/like.svg'
import LikeNoIcon from '@renderer/assets/icons/like_no.svg'
import DeleteIcon from '@renderer/assets/icons/playlistmodal/delete.svg'

const playerStore = usePlayerStore()
const myPlaylistStore = useMyPlaylistStore()

const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handlePlay = (track: Track) => {
  playerStore.playTrack(track)
}

const handleClearHistory = () => {
  if (confirm('确定要清空最近播放记录吗？')) {
    playerStore.clearHistory()
  }
}

const handlePlayAll = () => {
  const historyTracks = playerStore.getHistory()
  if (historyTracks.length > 0) {
    playerStore.setPlaylist(historyTracks, 0)
    playerStore.playByIndex(0)
  }
}

const handleAddToPlaylist = (track: Track) => {
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

</script>

<template>
  <div class="h-full flex flex-col bg-secondary select-none">
    <!-- 页面头部 -->
    <div class="px-8 pt-6">
      <div class="flex items-end gap-3 mb-6">
        <h1 class="text-2xl font-bold text-primary">最近播放</h1>
        <span class="text-gray-500 text-sm">共 {{ playerStore.getHistory().length }} 首</span>
      </div>
      
      <!-- 操作按钮 -->
      <div class="flex items-center gap-4 mb-6">
        <button
          class="px-6 py-2 bg-hover text-primary rounded-full flex items-center gap-2 hover:bg-active transition-all hover:scale-110 active:scale-95 cursor-pointer"
          :disabled="playerStore.getHistory().length === 0"
          @click="handlePlayAll"
        >
          <span class="text-lg">
            <img :src="PlayIcon" class="w-3 h-3" />
          </span>
          <span class="font-medium">播放全部</span>
        </button>
        <button
          class="px-6 py-2 bg-hover text-primary rounded-full flex items-center gap-2 hover:bg-active transition-all hover:scale-110 active:scale-95 cursor-pointer"
          :disabled="playerStore.getHistory().length === 0"
          @click="handleClearHistory"
        >
          <span class="text-lg">
            <img :src="DeleteIcon" class="w-3 h-3" />
          </span>
          <span class="font-medium">清空列表</span>
        </button>
      </div>
    </div>

    <!-- 歌曲列表 -->
    <div class="flex-1 overflow-y-auto px-8 pb-6">
      <div v-if="playerStore.getHistory().length === 0" class="flex flex-col items-center justify-center h-96 text-gray-500">
        <span class="text-6xl mb-4">🎵</span>
        <span class="text-xl">暂无最近播放的歌曲</span>
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
            v-for="(track, index) in playerStore.getHistory()"
            :key="track.id"
            class="track-row hover:scale-105 activate:scale-95 cursor-pointer duration-300"
            :class="{ 'bg-active': playerStore.currentTrack?.id === track.id }"
          >
            <td class="track-index">
              <span v-if="playerStore.currentTrack?.id === track.id && playerStore.isPlaying">
                <span class="text-pink-500">♪</span>
              </span>
              <span v-else>{{ index + 1 }}</span>
            </td>
            <td class="track-name">
              <div class="track-cover">
                <img
                  :src="track.album.picUrl"
                  class="w-full h-full object-cover"
                  :alt="track.name"
                />
              </div>
              <div class="track-info">
                <span class="track-title">{{ track.name }}</span>
                <span class="track-artists">{{ track.artists.map(a => a.name).join(' / ') }}</span>
              </div>
            </td>
            <td class="track-album">{{ track.album.name }}</td>
            <td class="track-actions">
              <button class="btn-icon" @click.stop="handlePlay(track)">
                <img :src="PlayIcon" class="w-4 h-4" />
              </button>
              <button
                class="btn-icon"
                :class="{ 'text-red-500': isInAnyPlaylist(track.id) }"
                @click.stop="handleAddToPlaylist(track)"
              >
                <img :src="isInAnyPlaylist(track.id) ? LikeIcon : LikeNoIcon" class="w-4 h-4" />
              </button>
            </td>
            <td class="track-duration">{{ formatDuration(track.duration) }}</td>
          </tr>
        </tbody>
      </table>
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  color: #1a1a1a;
  margin-bottom: 16px;
}

.description {
  color: #666;
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
  color: #666;
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
  color: #999;
}
</style>
