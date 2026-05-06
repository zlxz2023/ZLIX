import request from '@renderer/utils/request'

export interface Song {
    id: string
    mid?: string
    name: string
    artist: string
    album: string
    duration?: number
}

export interface SearchResult {
    code: number
    songs: Song[]
    total?: number
}

export interface SearchSong {
  id: number
  name: string
  ar: Array<{ id: number; name: string }>
  al: { id: number; name: string; picUrl: string }
  dt: number
}

export interface SearchAlbum {
    id: number;
    name: string;
    picUrl: string;
    artist: { id: number; name: string };
}

export interface SearchArtist {
    id: number;
    name: string;
    picUrl: string;
    img1v1Url?: string;
}

export interface SearchPlaylist {
    id: number;
    name: string;
    coverImgUrl: string;
    playCount?: number;
    trackCount?: number;
}

export interface SearchMv {
  id: number
  name: string
  cover: string
  artistName: string
  playCount: number
  duration?: number
}

export interface CloudSearchResult {
  code: number
  result?: {
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
  }
}

export interface LyricResult {
    code: number
    lrc?: string
    qrc?: string
    trans?: string
    roma?: string
}

// 解锁服务器枚举
export enum SongUnlockServer {
    NETEASE = 'netease', // GD音乐台的netease API，直接用ID获取
    KUWO = 'kuwo',
    BODIAN = 'bodian',
    GEQUBAO = 'gequbao',
}

export const processImageUrl = (url: string | undefined, size?: number): string => {
    if (!url) return ''
    let processedUrl = url.replace(/^http:/, 'https:')
    if (size) {
        processedUrl += `?param=${size}y${size}`
    }
    return processedUrl
}

type UnblockResult = { code: number; url?: string }

// ========== 搜索相关 ==========
export async function searchMusic(keyword: string): Promise<SearchResult> {
    return request.get('/qqmusic/search', { keyword })
}

export async function cloudSearch(keyword: string, type: number = 1, offset: number = 0, limit: number = 30): Promise<CloudSearchResult> {
    return request.get('/netease/cloudsearch', { keywords: keyword, type, offset, limit })
}

// ========== 歌词相关 ==========
export async function getLyric(id: string, name: string, artist: string): Promise<LyricResult> {
    return request.get('/qqmusic/lyric', { id, name, artist })
}

// 网易云歌词 API（更全面）
export interface NeteaseLyricResult {
    code: number
    lrc?: {
        version: number
        lyric: string
    }
    tlyric?: {
        version: number
        lyric: string
    }
    romalrc?: {
        version: number
        lyric: string
    }
    yrc?: {
        version: number
        lyric: string
    }
}

export async function getNeteaseLyric(id: number | string): Promise<NeteaseLyricResult> {
    return request.get('/netease/lyric_new', { id })
}

// ========== 新歌相关 ==========
export async function getNewSongs(type: number = 0) {
    return request.get('/netease/top/song', { type })
        .then(data => data.data || [])
}

// ========== 歌曲音频源信息 ==========
export interface AudioSource {
    url: string | null
    source: 'official' | 'kugou' | 'unlock'
    quality?: string
}

// ========== 核心：获取歌曲播放地址（SongManager 逻辑） ==========
const AUDIO_SOURCES = [
    SongUnlockServer.NETEASE,    // 优先：GD音乐台（用ID，最准）
    SongUnlockServer.KUWO,
    SongUnlockServer.BODIAN,
    SongUnlockServer.GEQUBAO
] as const
const SOURCE_TIMEOUT = 5000

// 酷狗概念版 API 请求
async function fetchKugouUrl(
    songName: string,
    artist: string
): Promise<{ url: string; source: 'kugou' } | null> {
    const startTime = Date.now()

    try {
        const { kugouSearchMixed, kugouGetSongUrl } = await import('@renderer/api/kugou/music')
        
        console.log(`[Audio] 🐶 尝试酷狗搜索: ${songName} - ${artist}`)
        
        // 1. 搜索歌曲
        const searchResult = await kugouSearchMixed(`${songName} ${artist}`)
        const songs = searchResult?.data?.lists || searchResult?.data?.songlist || []
        
        if (!songs || songs.length === 0) {
            console.log(`[Audio] ⚠️ 酷狗搜索无结果`)
            return null
        }

        // 2. 取第一个结果获取URL
        const firstSong = songs[0]
        const hash = firstSong.hash || firstSong.songhash
        const albumId = firstSong.album_id || firstSong.albumid || 0
        const audioId = firstSong.audio_id || firstSong.songid || 0
        
        if (!hash) {
            console.log(`[Audio] ⚠️ 酷狗无hash`)
            return null
        }

        // 3. 获取播放URL
        const urlResult = await kugouGetSongUrl(hash, albumId, audioId)
        const url = urlResult?.data?.url
        
        if (url) {
            console.log(`[Audio] ✅ 酷狗成功: ${Date.now() - startTime}ms`)
            return { url, source: 'kugou' }
        }
        
        console.log(`[Audio] ⚠️ 酷狗无有效 URL`)
        return null
    } catch (error) {
        console.error(`[Audio] ❌ 酷狗失败: ${(error as Error).message}`)
        return null
    }
}

// unblock 并发请求（Promise.any，谁快用谁）
async function fetchUnblockUrl(
    id: number | string,
    keyword: string,
    songName: string,
    artist: string
): Promise<{ url: string; source: 'unlock' } | null> {
    const startTime = Date.now()

    const sourcePromises = AUDIO_SOURCES.map(async (source) => {
        try {
            let data: UnblockResult
            if (source === SongUnlockServer.NETEASE) {
                // GD音乐台用ID获取
                data = await request.get<UnblockResult>(`/unblock/${source}`, { id })
            } else {
                // 其他用keyword、songName、artist
                data = await request.get<UnblockResult>(`/unblock/${source}`, { keyword, songName, artist })
            }
            
            if (data?.code === 200 && data.url) {
                console.log(`[Audio] ✅ ${source} 成功: ${Date.now() - startTime}ms`)
                return data.url
            }
            throw new Error(`${source} 无有效 URL`)
        } catch (error) {
            throw error
        }
    })

    const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('所有源请求超时')), SOURCE_TIMEOUT * AUDIO_SOURCES.length)
    })

    try {
        const url = await Promise.any([...sourcePromises, timeoutPromise])
        console.log(`[Audio] 🔓 Unblock 总耗时: ${Date.now() - startTime}ms`)
        return { url: url || '', source: 'unlock' }
    } catch (error) {
        console.error(`[Audio] ❌ Unblock 全部失败: ${(error as Error).message}`)
        return null
    }
}

// 官方 API 请求
async function fetchOfficialUrl(id: number | string, level: string = 'exhigh'): Promise<{ url: string | null; isTrial: boolean }> {
    const startTime = Date.now()

    try {
        const data = await request.get('/netease/song/url', { id, level })
        const songData = data?.data?.[0]
        const url = songData?.url
        const isTrial = songData?.freeTrialInfo != null // 关键：检查是否为试听

        if (url && !isTrial) {
            console.log(`[Audio] ✅ 官方成功（非试听）: ${Date.now() - startTime}ms`)
            return { url, isTrial: false }
        } else if (url && isTrial) {
            console.log(`[Audio] ⚠️ 官方仅为试听，跳过`)
            return { url: null, isTrial: true }
        }

        console.log(`[Audio] ⚠️ 官方无有效 URL`)
        return { url: null, isTrial: false }
    } catch (error) {
        console.error(`[Audio] ❌ 官方失败: ${(error as Error).message}`)
        return { url: null, isTrial: false }
    }
}

/**
 * 获取歌曲播放地址
 * 核心逻辑：
 * 1. 先尝试网易云官方 API（快、音质好）
 * 2. 如果官方只有试听或失败，尝试酷狗概念版 API
 * 3. 如果酷狗也失败，尝试 unblock 解锁源
 *
 * @param id 歌曲 ID（网易云数字 ID）
 * @param songName 歌曲名（用于搜索）
 * @param artist 艺术家名（用于搜索）
 * @returns 包含 url 和 source 的对象
 */
export async function getAudioSource(
    id: number | string,
    songName: string,
    artist: string
): Promise<AudioSource> {
    console.log(`[Audio] ========== 开始获取音频 ==========`)
    console.log(`[Audio] 歌曲: ${songName} - ${artist}`)
    console.log(`[Audio] ID: ${id}`)

    // 1️⃣ 优先尝试网易云官方 API
    const officialResult = await fetchOfficialUrl(id)
    if (officialResult.url) {
        return { url: officialResult.url, source: 'official' }
    }

    // 2️⃣ 官方失败或仅试听，尝试酷狗概念版 API
    console.log(`[Audio] 🔄 官方失败/仅试听，尝试酷狗概念版...`)
    const kugouResult = await fetchKugouUrl(songName, artist)
    if (kugouResult) {
        return kugouResult
    }

    // 3️⃣ 酷狗失败，尝试 unblock 解锁源
    const keyword = `${songName}-${artist}`
    console.log(`[Audio] 🔄 酷狗失败，尝试 Unblock...`)

    const unblockResult = await fetchUnblockUrl(id, keyword, songName, artist)
    if (unblockResult) {
        return unblockResult
    }

    // 4️⃣ 全部失败
    console.error(`[Audio] ❌ 无法获取音频`)
    return { url: null, source: 'unlock' }
}
