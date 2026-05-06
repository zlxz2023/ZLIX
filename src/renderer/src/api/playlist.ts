import request from '@renderer/utils/request'
import { processImageUrl } from './song'


export interface Playlist {
    id: number
    name: string
    picUrl: string
    copywriter?: string
    playCount?: number
    trackCount?: number
}

export interface PlaylistCatItem {
    name: string
    resourceCount?: number
}

export interface PlaylistCatResult {
    categories: {
        name: string
        subs: PlaylistCatItem[]
    }[]
}

export interface PlaylistDetail {
    id: number
    name: string
    coverImgUrl: string
    description: string
    playCount: number
    trackCount: number
    creator?: {
        userId: number
        nickname: string
        avatarUrl: string
    }
    tracks?: PlaylistTrack[]
}

export interface PlaylistTrack {
    id: number
    name: string
    duration: number
    al: {
        id: number
        name: string
        picUrl: string
    }
    ar: {
        id: number
        name: string
    }[]
}

export interface TopList {
    id: number
    name: string
    coverImgUrl: string
    updateFrequency: string
    playCount: number
}

// ========== 推荐歌单 ==========
export async function getRecommendPlaylists(limit = 20): Promise<Playlist[]> {
    return request.get('/netease/personalized', { type: 'playlist', limit })
        .then(data => {
            const playlists = data.result || []
            return playlists.map((item: any) => ({
                ...item,
                picUrl: processImageUrl(item.picUrl, 300),
            }))
        })
}

// ========== 歌单分类列表 ==========
export async function getPlaylistCatlist(): Promise<PlaylistCatResult> {
    return request.get('/netease/playlist/catlist')
}

// ========== 歌单分类查询 ==========
export async function getPlaylistCategories(cat: string = '全部', limit: number = 30, offset: number = 0, hq: boolean = false): Promise<Playlist[]> {
    const url = hq ? '/netease/top/playlist/highquality' : '/netease/top/playlist'
    return request.get(url, { cat, limit, offset })
        .then(data => {
            const playlists = data.playlists || []
            return playlists.map((item: any) => ({
                ...item,
                picUrl: processImageUrl(item.coverImgUrl || item.picUrl, 300),
            }))
        })
}

// ========== 歌单详情 ==========
export async function getPlaylistDetail(id: number): Promise<PlaylistDetail> {
    return request.get('/netease/playlist/detail', { id })
        .then(data => data.playlist)
}

// ========== 歌单歌曲 ==========
export async function getPlaylistTracks(id: number, limit: number = 50, offset: number = 0): Promise<PlaylistTrack[]> {
    return request.get('/netease/playlist/detail', { id, limit, offset })
        .then(data => data.playlist.tracks || [])
}

// ========== 排行榜 ==========
export async function getToplist(): Promise<TopList[]> {
    return request.get('/netease/toplist')
        .then(data => {
            const list = data.list || []
            return list.map((item: any) => ({
                ...item,
                coverImgUrl: processImageUrl(item.coverImgUrl, 300),
            }))
        })
}