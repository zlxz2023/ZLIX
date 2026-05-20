import request from '@renderer/utils/request'
import { processImageUrl } from './song'

export interface Mv {
    id: number
    name: string
    cover: string
    artistName?: string
    duration?: number
}

// ========== 全部 MV ==========
export async function getAllMv(limit = 10): Promise<Mv[]> {
    return request.get('/netease/mv/all', { limit })
        .then(data => {
            const mvs = data.data || []
            return mvs.map((item: any) => ({
                ...item,
                cover: processImageUrl(item.cover, 600),
            }))
        })
}

// ========== 获取MV播放地址 ==========
export async function getMvUrl(id: number): Promise<string | null> {
    const data = await request.get('/netease/mv/url', { id })
    return data.data?.url || null
}