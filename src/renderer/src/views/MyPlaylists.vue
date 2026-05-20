<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMyPlaylistStore, type MyPlaylist } from '@renderer/stores/myPlaylists'

const router = useRouter()
const myPlaylistStore = useMyPlaylistStore()

const playlists = computed(() => myPlaylistStore.playlists)
const editMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const formatPlayCount = (count: number) => {
    if (count >= 100000000) {
        return (count / 100000000).toFixed(1) + '亿'
    } else if (count >= 10000) {
        return (count / 10000).toFixed(1) + '万'
    }
    return count.toString()
}

const handlePlaylistClick = async (playlist: MyPlaylist) => {
    if (editMode.value) {
        toggleSelect(playlist.id)
        return
    }
    try {
        await router.push(`/main/playlist/${playlist.id}`)
    } catch (error) {
        console.error('跳转失败:', error)
    }
}

const toggleSelect = (id: string) => {
    if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id)
    } else {
        selectedIds.value.add(id)
    }
}

const selectAll = () => {
    const deletableIds = playlists.value.filter((p) => !p.isDefault).map((p) => p.id)
    if (selectedIds.value.size === deletableIds.length) {
        selectedIds.value.clear()
    } else {
        selectedIds.value = new Set(deletableIds)
    }
}

const batchDelete = () => {
    if (selectedIds.value.size === 0) return
    if (!confirm(`确定要删除 ${selectedIds.value.size} 个歌单吗？`)) return

    const ids = Array.from(selectedIds.value)
    myPlaylistStore.batchDelete(ids)
    selectedIds.value.clear()
    editMode.value = false
}

const exitEditMode = () => {
    editMode.value = false
    selectedIds.value.clear()
}
</script>

<template>
    <div class="h-full flex flex-col bg-secondary select-none">
        <!-- 页面头部 -->
        <div class="px-8 pt-6">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-end gap-3">
                    <h1 class="text-2xl font-bold text-primary">自建歌单</h1>
                    <span class="text-secondary text-sm">共 {{ playlists.length }} 个</span>
                </div>
                <div class="flex items-center gap-3">
                    <template v-if="!editMode">
                        <button
                            v-if="playlists.length > 1"
                            class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            @click="editMode = true"
                        >
                            批量管理
                        </button>
                        <button
                            class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
                            @click="myPlaylistStore.openCreateModal()"
                        >
                            新建歌单
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
                            {{
                                selectedIds.size === playlists.filter((p) => !p.isDefault).length
                                    ? '取消全选'
                                    : '选择全部'
                            }}
                        </button>
                        <button
                            class="px-6 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="selectedIds.size === 0"
                            @click="batchDelete"
                        >
                            删除 ({{ selectedIds.size }})
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- 歌单列表 -->
        <div class="flex-1 overflow-y-auto px-8 pb-6">
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                <div
                    v-for="item in playlists"
                    :key="item.id"
                    class="playlist-card group"
                    :class="{ 'cursor-pointer': !editMode }"
                    @click="handlePlaylistClick(item)"
                >
                    <div class="relative w-full aspect-square rounded-xl mb-3 overflow-hidden">
                        <!-- 选择框 -->
                        <div v-if="editMode && !item.isDefault" class="absolute top-2 left-2 z-10">
                            <div
                                class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
                                :class="
                                    selectedIds.has(item.id)
                                        ? 'bg-red-500 border-red-500'
                                        : 'bg-active/80 border-theme'
                                "
                            >
                                <span v-if="selectedIds.has(item.id)" class="text-white text-xs"
                                    >✓</span
                                >
                            </div>
                        </div>

                        <div v-if="item.picUrl" class="w-full h-full">
                            <img
                                :src="item.picUrl"
                                :alt="item.name"
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                        <div
                            v-else
                            class="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-4xl"
                        >
                            {{ item.isDefault ? '❤️' : '🎵' }}
                        </div>

                        <div
                            v-if="item.playCount"
                            class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
                        >
                            <span>▶</span>
                            <span>{{ formatPlayCount(item.playCount) }}</span>
                        </div>

                        <!-- 默认歌单标签 -->
                        <div
                            v-if="item.isDefault"
                            class="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded"
                        >
                            默认
                        </div>
                    </div>
                    <h3 class="text-primary font-medium text-sm leading-snug line-clamp-2">
                        {{ item.name }}
                    </h3>
                    <p class="text-secondary text-xs mt-1">{{ item.trackCount }} 首歌曲</p>
                </div>
            </div>
        </div>

        <!-- 新建歌单弹窗 -->
        <div
            v-if="myPlaylistStore.showCreateModal"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            @click.self="myPlaylistStore.closeCreateModal()"
        >
            <div class="bg-secondary rounded-xl p-6 w-96 shadow-xl border border-theme">
                <h2 class="text-xl font-bold text-primary mb-4">新建歌单</h2>
                <div class="mb-4">
                    <label class="block text-secondary text-sm font-medium mb-2">歌单名称</label>
                    <input
                        v-model="myPlaylistStore.newPlaylistName"
                        type="text"
                        placeholder="请输入歌单名称"
                        class="w-full px-6 py-2 border border-theme rounded-lg text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-300 focus:w-full bg-secondary"
                        @keyup.enter="myPlaylistStore.handleCreatePlaylist()"
                    />
                </div>
                <div class="flex justify-end gap-3">
                    <button
                        class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        @click="myPlaylistStore.closeCreateModal()"
                    >
                        取消
                    </button>
                    <button
                        class="px-4 py-2 bg-hover border border-theme rounded-lg text-primary hover:bg-active hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        @click="myPlaylistStore.handleCreatePlaylist()"
                    >
                        创建
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
</style>