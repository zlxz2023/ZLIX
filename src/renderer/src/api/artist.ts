import request from '@renderer/utils/request'
import { processImageUrl } from './song'

export interface Artist {
    id: number
    name: string
    picUrl: string
    albumSize?: number
    fansCount?: number
}

export interface ArtistDetail extends Artist {
    briefDesc?: string
}

export interface ArtistAlbum {
    id: number
    name: string
    picUrl: string
    publishTime?: number
    size?: number
}

export interface ArtistMv {
    id: number
    name: string
    cover: string
    playCount?: number
}

export interface AlbumDetail {
    id: number
    name: string
    picUrl: string
    artist: { id: number; name: string }
    description?: string
    songs: Array<{
        id: number
        name: string
        ar?: Array<{ id?: number; name: string }>
        al?: { id?: number; name: string; picUrl?: string }
        dt?: number
    }>
    duration?: number
    publishTime?: string
}

export interface Song {
    id: number | string
    name: string
    artists: Array<{ id?: number; name: string }>
    album: { id?: number; name: string; picUrl: string }
    duration: number
}

// ========== 热门歌手 ==========
export async function getTopArtists(limit = 6): Promise<Artist[]> {
    return request.get('/netease/top/artists', { limit })
        .then(data => {
            const artists = data.artists || []
            return artists.map((item: any) => ({
                ...item,
                picUrl: processImageUrl(item.picUrl, 300),
            }))
        })
}

// ========== 歌手分类查询 ==========
export async function getArtistList(type: number = -1, area: number = -1, initial: string = '-1', limit: number = 50, offset: number = 0): Promise<Artist[]> {
    return request.get('/netease/artist/list', { type, area, initial, limit, offset })
        .then(data => {
            const artists = data.artists || []
            return artists.map((item: any) => ({
                ...item,
                picUrl: processImageUrl(item.picUrl, 300),
            }))
        })
}

// ========== 歌手详情 ==========
export async function getArtistDetail(id: number): Promise<ArtistDetail> {
    return request.get('/netease/artist/detail', { id })
        .then(data => {
            const artist = data.data?.artist || {}
            return {
                ...artist,
                picUrl: processImageUrl(artist.cover || artist.picUrl, 300),
            }
        })
}

// ========== 歌手热门歌曲 ==========
export async function getArtistTopSongs(id: number): Promise<Song[]> {
    return request.get('/netease/artist/top/song', { id })
        .then(data => {
            const songs = data.songs || []
            return songs.map((item: any) => ({
                id: item.id,
                name: item.name,
                artists: item.ar || [],
                album: {
                    id: item.al?.id,
                    name: item.al?.name,
                    picUrl: processImageUrl(item.al?.picUrl, 300),
                },
                duration: item.dt || 0,
            }))
        })
}

// ========== 歌手专辑 ==========
export async function getArtistAlbums(id: number, limit = 30, offset = 0): Promise<ArtistAlbum[]> {
    return request.get('/netease/artist/album', { id, limit, offset })
        .then(data => {
            const albums = data.hotAlbums || []
            return albums.map((item: any) => ({
                ...item,
                picUrl: processImageUrl(item.picUrl, 300),
            }))
        })
}

// ========== 歌手MV ==========
export async function getArtistMvs(id: number, limit = 30, offset = 0): Promise<ArtistMv[]> {
    return request.get('/netease/artist/mv', { id, limit, offset })
        .then(data => {
            const mvs = data.mvs || []
            return mvs.map((item: any) => ({
                ...item,
                cover: processImageUrl(item.imgurl16v9 || item.imgurl || item.cover, 300),
            }))
        })
}

// ========== 专辑详情 ==========
export async function getAlbumDetail(id: number): Promise<AlbumDetail> {
    const data = await request.get('/netease/album', { id })
    
    const album = data.album || data
    // 歌曲列表在 data 根级，不在 album 里面！
    const songs = data.songs || album.songs || album.tracks || []
    
    return {
        id: album.id || album.albumId,
        name: album.name || album.albumName,
        picUrl: processImageUrl(album.picUrl || album.coverUrl || album.cover, 300),
        artist: {
            id: album.artist?.id || album.singer?.id || 0,
            name: album.artist?.name || album.singer?.name || '',
        },
        description: album.description,
        songs: songs,
        duration: album.duration,
        publishTime: album.publishTime ? new Date(Number(album.publishTime)).toLocaleDateString() : '',
    }
}