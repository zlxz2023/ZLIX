import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAudioSource, type AudioSource } from '@renderer/api/song'
import { useLyricsStore } from './lyrics'
import { logger } from '@renderer/utils/logger'

// 播放模式枚举
export enum PlayMode {
    LOOP = 'loop',             // 列表循环
    SINGLE = 'single',         // 单曲循环
    RANDOM = 'random',         // 随机播放
}

// 歌曲轨道接口
export interface Track {
    id: number | string
    name: string
    artists: Array<{ id?: number; name: string }>
    album: { id?: number; name: string; picUrl: string }
    duration: number
    url?: string
    source?: 'official' | 'unlock'
    quality?: string
}

// 播放历史记录
interface HistoryItem {
    track: Track
    playedAt: number
}

// URL 缓存
const urlCache = new Map<string, AudioSource>()

export const usePlayerStore = defineStore('player', () => {
    // ==================== 状态 ====================
    // 播放队列（用 ref 而不是 shallowRef，因为需要在数组内部修改）
    const playlist = ref<Track[]>([])
    // 当前播放索引
    const currentIndex = ref<number>(-1)
    // 是否显示播放列表
    const showPlaylist = ref<boolean>(false)
    // 是否收起PlayerBar
    const isCollapsed = ref<boolean>(false)
    // 播放状态
    const isPlaying = ref<boolean>(false)
    // 当前时间（秒）
    const currentTime = ref<number>(0)
    // 总时长（秒）
    const duration = ref<number>(0)
    // 音量（0-100）
    const volume = ref<number>(100)
    // 是否静音
    const isMuted = ref<boolean>(false)
    // 播放模式
    const playMode = ref<PlayMode>(PlayMode.LOOP)
    // 播放历史
    const playHistory = ref<HistoryItem[]>([])
    // 当前播放源信息
    const currentSource = ref<AudioSource | null>(null)
    // 歌词窗口是否可见
    const isLyricsWindowVisible = ref<boolean>(false)

    // ==================== 请求令牌 ====================
    // 用于避免竞态条件
    let currentRequestToken = 0
    // 是否正在切换歌曲（防止重复触发）
    let isTransitioning = false
    // 上次切歌时间（防抖）
    let lastSwitchTime = 0
    const SWITCH_DEBOUNCE_MS = 300

    // ==================== 计算属性 ====================
    // 当前播放歌曲
    const currentTrack = computed<Track | null>(() => {
        if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
            return playlist.value[currentIndex.value]
        }
        return null
    })

    // 是否有上一首（闭环：第1首的上一首是最后一首）
    const hasPrev = computed<boolean>(() => {
        return playlist.value.length > 0
    })

    // 是否有下一首（闭环：最后一首的下一首是第1首）
    const hasNext = computed<boolean>(() => {
        return playlist.value.length > 0
    })

    // 播放进度（百分比）
    const progress = computed<number>(() => {
        if (duration.value === 0) return 0
        return (currentTime.value / duration.value) * 100
    })

    // 格式化当前时间
    const formattedCurrentTime = computed<string>(() => formatTime(currentTime.value))

    // 格式化总时长
    const formattedDuration = computed<string>(() => formatTime(duration.value))

    // ==================== 工具函数 ====================
    // 生成缓存 key
    const getCacheKey = (track: Track) => {
        return `${track.id}-${track.artists.map(a => a.name).join('')}`
    }

    // 格式化时间（秒 -> mm:ss）
    const formatTime = (seconds: number): string => {
        if (!seconds || isNaN(seconds)) return '00:00'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // ==================== URL 获取（带缓存） ====================
    const fetchTrackSource = async (track: Track): Promise<AudioSource | null> => {
        const cacheKey = getCacheKey(track)

        // 检查缓存
        if (urlCache.has(cacheKey)) {
            return urlCache.get(cacheKey)!
        }

        const artistName = track.artists.map(a => a.name).join(' ')
        let retries = 0
        const maxRetries = 2

        while (retries <= maxRetries) {
            try {
                const result = await getAudioSource(track.id, track.name, artistName)
                if (result.url) {
                    // 存入缓存
                    urlCache.set(cacheKey, result)
                    return result
                }
            } catch (error) {
                logger.debug('Player', `获取 URL 失败，重试次数: ${retries}`, error)
            }

            retries++
            if (retries <= maxRetries) {
                // 指数退避等待
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, retries)))
            }
        }

        logger.error('Player', `无法获取音频: ${track.name}`)
        return null
    }

    // ==================== 播放控制 ====================
    // 播放指定索引的歌曲
    const playByIndex = async (index: number, autoPlay: boolean = true) => {
        // 边界检查
        if (index < 0 || index >= playlist.value.length) return

        // 防抖检查
        const now = Date.now()
        if (now - lastSwitchTime < SWITCH_DEBOUNCE_MS) {
            return
        }
        lastSwitchTime = now

        // 防止重复切换
        if (isTransitioning) {
            return
        }
        isTransitioning = true

        // 生成新的请求令牌
        currentRequestToken++
        const requestToken = currentRequestToken

        const track = playlist.value[index]
        if (!track) {
            isTransitioning = false
            return
        }

        // 先停止当前播放
        try {
            await (window as any).api.mpv.stop()
        } catch (e) {
            // 忽略停止错误
        }

        // 先更新索引（同步操作）
        currentIndex.value = index

        // 获取音频源（异步操作）
        const source = await fetchTrackSource(track)

        // 检查令牌是否过期
        if (requestToken !== currentRequestToken) {
            isTransitioning = false
            return
        }

        if (!source?.url) {
            isTransitioning = false
            return
        }

        // 更新当前源信息
        currentSource.value = source

        try {
            // 加载并播放
            await (window as any).api.mpv.load(source.url)
            if (autoPlay) {
                await (window as any).api.mpv.play()
                isPlaying.value = true
            }

            // 添加到播放历史
            addToHistory(track)

            // 获取歌词
            const lyricsStore = useLyricsStore()
            const artistName = track.artists.map(a => a.name).join(' ')
            lyricsStore.fetchLyrics(
                track.id,
                track.name,
                artistName,
            )
        } catch (error: any) {
            logger.error('Player', 'mpv 播放失败', error)
            isPlaying.value = false
        } finally {
            isTransitioning = false
        }
    }

    // 播放指定歌曲
    const playTrack = async (track: Track) => {
        // 查找歌曲是否已在队列中
        let index = playlist.value.findIndex(t => t.id === track.id)

        if (index === -1) {
            // 不在队列中，添加到末尾
            playlist.value.push(track)
            index = playlist.value.length - 1
        }

        await playByIndex(index)
    }

    // 播放上一首（闭环：第1首的上一首是最后一首）
    const playPrev = async () => {
        if (playlist.value.length === 0) return

        let prevIndex: number
        if (playMode.value === PlayMode.RANDOM) {
            // 随机播放：随机选一首不是当前的
            const availableIndices = playlist.value
                .map((_, i) => i)
                .filter(i => i !== currentIndex.value)
            prevIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        } else {
            // 闭环：当前是第一首就跳到最后一首
            prevIndex = currentIndex.value - 1
            if (prevIndex < 0) {
                prevIndex = playlist.value.length - 1
            }
        }
        
        await playByIndex(prevIndex)
    }

    // 播放下一首（闭环：最后一首的下一首是第1首）
    const playNext = async () => {
        if (playlist.value.length === 0) return

        let nextIndex: number
        if (playMode.value === PlayMode.RANDOM) {
            // 随机播放：随机选一首不是当前的
            const availableIndices = playlist.value
                .map((_, i) => i)
                .filter(i => i !== currentIndex.value)
            nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        } else {
            // 闭环：当前是最后一首就跳到第一首
            nextIndex = currentIndex.value + 1
            if (nextIndex >= playlist.value.length) {
                nextIndex = 0
            }
        }
        
        await playByIndex(nextIndex)
    }

    // 自动播放下一首（用于播放结束或单曲循环）
    const playNextAuto = async () => {
        // 防止重复触发
        if (isTransitioning) {
            console.log('[Player] ⏳ 正在切换中，忽略自动播放')
            return
        }

        // 单曲循环模式：重新播放当前
        if (playMode.value === PlayMode.SINGLE) {
            await playByIndex(currentIndex.value)
            return
        }

        // 列表循环或顺序：播放下一首（闭环）
        let nextIndex: number
        if (playMode.value === PlayMode.RANDOM) {
            // 随机播放：随机选一首不是当前的
            const availableIndices = playlist.value
                .map((_, i) => i)
                .filter(i => i !== currentIndex.value)
            nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        } else {
            nextIndex = currentIndex.value + 1
            // 闭环：最后一首的下一首是第一首
            if (nextIndex >= playlist.value.length) {
                nextIndex = 0
            }
        }
        
        await playByIndex(nextIndex)
    }

    // ==================== 播放列表管理 ====================
    // 设置播放列表（替换现有列表）
    const setPlaylist = (tracks: Track[], startIndex = 0) => {
        playlist.value = [...tracks]
        currentIndex.value = startIndex
    }

    // 添加歌曲到队列
    const addToQueue = (track: Track) => {
        playlist.value.push(track)
    }

    // 从队列中移除歌曲
    const removeFromQueue = (index: number) => {
        if (index < 0 || index >= playlist.value.length) return

        const track = playlist.value[index]
        const cacheKey = getCacheKey(track)
        urlCache.delete(cacheKey)

        playlist.value.splice(index, 1)

        // 调整当前索引
        if (index < currentIndex.value) {
            currentIndex.value--
        } else if (index === currentIndex.value) {
            if (playlist.value.length > 0) {
                if (index >= playlist.value.length) {
                    currentIndex.value = playlist.value.length - 1
                }
                // 自动播放新位置的歌曲
                const newTrack = playlist.value[currentIndex.value]
                if (newTrack?.url) {
                    ;(window as any).api.mpv.load(newTrack.url)
                } else {
                    playByIndex(currentIndex.value)
                }
            } else {
                currentIndex.value = -1
                ;(window as any).api.mpv.stop()
            }
        }
    }

    // 清空队列
    const clearQueue = async () => {
        // 先释放状态锁定
        isTransitioning = false

        playlist.value = []
        currentIndex.value = -1
        currentRequestToken++
        urlCache.clear()
        isPlaying.value = false
        currentTime.value = 0
        duration.value = 0
        currentSource.value = null

        try {
            await (window as any).api.mpv.stop()
        } catch (error) {
            console.error('[Player] ❌ 停止播放失败:', error)
        }

        console.log('[Player] 🧹 播放列表已清空')
    }

    // 切换播放列表显示
    const togglePlaylist = () => {
        showPlaylist.value = !showPlaylist.value
    }

    // 收起/展开 PlayerBar
    const toggleCollapse = () => {
        isCollapsed.value = !isCollapsed.value
    }

    // 切换歌词窗口可见性
    const toggleLyricsWindow = () => {
        isLyricsWindowVisible.value = !isLyricsWindowVisible.value
        if ((window as any).api?.lyricsWindow) {
            (window as any).api.lyricsWindow.toggle()
            
            // 如果是打开歌词窗口，发送当前歌词信息
            if (isLyricsWindowVisible.value) {
                sendLyricsToWindow()
            }
        }
    }

    // 发送歌词到歌词窗口
    const sendLyricsToWindow = () => {
        const api = (window as any).api
        if (!api?.lyricsWindow) return
        
        const currentTrack = playlist.value[currentIndex.value]
        const lyricsStore = useLyricsStore()
        api.lyricsWindow.sendLyricsUpdate({
            songName: currentTrack?.name || '',
            artistName: currentTrack?.artists?.map((a: any) => a.name).join(' ') || '',
            currentTime: currentTime.value,
            isPlaying: isPlaying.value,
            lyrics: JSON.parse(JSON.stringify(lyricsStore.currentLyrics))
        })
    }

    // 设置歌词窗口可见性
    const setLyricsWindowVisible = (visible: boolean) => {
        isLyricsWindowVisible.value = visible
    }

    // ==================== 播放状态控制 ====================
    // 播放/暂停切换
    const togglePlay = async () => {
        if (isPlaying.value) {
            await (window as any).api.mpv.pause()
            isPlaying.value = false
        } else {
            // 检查是否已有加载的源
            if (currentSource.value?.url) {
                // 已有加载的源，直接播放（不会重新加载）
                await (window as any).api.mpv.play()
                isPlaying.value = true
            } else if (currentTrack.value) {
                // 没有加载的源，需要重新加载
                await playByIndex(currentIndex.value)
            }
        }
    }

    // 跳转进度
    const seek = async (time: number) => {
        if (currentSource.value?.url) {
            await (window as any).api.mpv.seek(time)
            currentTime.value = time
        } else {
            console.warn('[Player] ⚠️ 没有加载的源，无法跳转进度')
        }
    }

    // 按百分比跳转
    const seekByPercent = async (percent: number) => {
        const time = (percent / 100) * duration.value
        await seek(time)
    }

    // 设置音量
    const setVolume = async (vol: number) => {
        volume.value = Math.max(0, Math.min(100, vol))
        await (window as any).api.mpv.setVolume(volume.value)
        if (volume.value > 0) {
            isMuted.value = false
        }
    }

    // 静音切换
    const toggleMute = async () => {
        isMuted.value = !isMuted.value
        if (isMuted.value) {
            await (window as any).api.mpv.setVolume(0)
        } else {
            await (window as any).api.mpv.setVolume(volume.value)
        }
    }

    // ==================== 播放模式 ====================
    // 切换播放模式
    const togglePlayMode = () => {
        const validModes = [PlayMode.LOOP, PlayMode.SINGLE, PlayMode.RANDOM]
        // 检查当前 playMode 是否有效
        if (!validModes.includes(playMode.value)) {
            logger.warn('Player', `无效的 playMode: ${playMode.value}，重置为列表循环`)
            playMode.value = PlayMode.LOOP
        }

        const modes = Object.values(PlayMode)
        const currentModeIndex = modes.indexOf(playMode.value)
        const nextModeIndex = (currentModeIndex + 1) % modes.length
        playMode.value = modes[nextModeIndex]
    }

    // ==================== 进度更新（由外部调用） ====================
    // 更新时间（从 mpv 事件获取）
    const updateCurrentTime = (time: number) => {
        currentTime.value = time
    }

    // 更新时长（从 mpv 事件获取）
    const updateDuration = (dur: number) => {
        duration.value = dur
    }

    // 设置播放状态（从 mpv 事件获取）
    const updatePlayingState = (playing: boolean) => {
        isPlaying.value = playing
    }

    // ==================== 播放历史 ====================
    // 添加到播放历史
    const addToHistory = (track: Track) => {
        // 先删除已有的相同歌曲
        playHistory.value = playHistory.value.filter(item => item.track.id !== track.id)
        
        // 再添加到最前面
        playHistory.value.unshift({
            track: { ...track },
            playedAt: Date.now(),
        })

        // // 只保留最近 50 条
        // if (playHistory.value.length > 50) {
        //     playHistory.value = playHistory.value.slice(0, 50)
        // }
    }

    // 获取播放历史
    const getHistory = (limit = 20): Track[] => {
        return playHistory.value.slice(0, limit).map(item => item.track)
    }

    // 清空历史
    const clearHistory = () => {
        playHistory.value = []
    }

    // ==================== 缓存管理 ====================
    // 预加载下一首（后台执行，不阻塞）
    const prefetchNext = async () => {
        if (!hasNext.value) return

        let nextIndex: number
        if (playMode.value === PlayMode.RANDOM) {
            const availableIndices = playlist.value
                .map((_, i) => i)
                .filter(i => i !== currentIndex.value)
            nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        } else {
            nextIndex = currentIndex.value + 1
        }

        const nextTrack = playlist.value[nextIndex]
        if (!nextTrack) return

        const cacheKey = getCacheKey(nextTrack)
        if (urlCache.has(cacheKey)) return // 已有缓存

        const artistName = nextTrack.artists.map(a => a.name).join(' ')

        try {
            const result = await getAudioSource(nextTrack.id, nextTrack.name, artistName)
            if (result.url) {
                urlCache.set(cacheKey, result)
            }
        } catch (error: any) {
            logger.debug('Player', `预加载失败: ${nextTrack.name}`, error)
        }
    }

    // 清除 URL 缓存
    const clearCache = () => {
        urlCache.clear()
    }

    // 初始化预加载（在播放队列有歌曲时自动获取URL和歌词）
    const initializePlayer = async () => {
        // 如果播放队列有歌曲，自动预加载当前歌曲的URL和歌词
        if (playlist.value.length > 0 && currentIndex.value >= 0 && currentIndex.value < playlist.value.length) {
            const track = playlist.value[currentIndex.value]
            
            // 预加载URL（使用缓存）
            const source = await fetchTrackSource(track)
            if (source?.url) {
                currentSource.value = source
                
                // 实际加载音频到 mpv（但不自动播放）
                try {
                    await (window as any).api.mpv.load(source.url)
                } catch (error: any) {
                    logger.error('Player', '初始化加载音频失败', error)
                }
            }

            // 预加载歌词
            const lyricsStore = useLyricsStore()
            const artistName = track.artists.map(a => a.name).join(' ')
            await lyricsStore.fetchLyrics(
                track.id,
                track.name,
                artistName,
            )
        }
    }

    // ==================== 返回 ====================
    return {
        // 状态
        playlist,
        currentIndex,
        currentTrack,
        showPlaylist,
        isCollapsed,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        playMode,
        playHistory,
        currentSource,
        isLyricsWindowVisible,

        // 计算属性
        hasPrev,
        hasNext,
        progress,
        formattedCurrentTime,
        formattedDuration,

        // 播放控制
        playTrack,
        playByIndex,
        playNext,
        playPrev,
        playNextAuto,
        togglePlay,
        seek,
        seekByPercent,

        // 播放列表管理
        setPlaylist,
        addToQueue,
        removeFromQueue,
        clearQueue,
        togglePlaylist,
        toggleCollapse,
        toggleLyricsWindow,
        setLyricsWindowVisible,
        sendLyricsToWindow,

        // 音量控制
        setVolume,
        toggleMute,

        // 播放模式
        togglePlayMode,

        // 进度更新（由 mpv 事件调用）
        updateCurrentTime,
        updateDuration,
        updatePlayingState,

        // 历史记录
        addToHistory,
        getHistory,
        clearHistory,

        // 缓存
        prefetchNext,
        clearCache,

        // 初始化
        initializePlayer,
    }
}, {
    persist: {
        key: 'music-player',
        storage: localStorage,
        pick: ['playlist', 'currentIndex', 'currentTime', 'playHistory', 'playMode', 'volume', 'isMuted']
    }
})


