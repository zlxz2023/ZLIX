import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getNeteaseLyric, type NeteaseLyricResult } from '@renderer/api/song'

export interface LyricLine {
    time: number       // 时间（秒）
    text: string       // 歌词文本
    trans?: string     // 翻译文本
    roma?: string     // 罗马音文本
}

export const useLyricsStore = defineStore('lyrics', () => {
    const currentLyrics = ref<LyricLine[]>([])
    const originalLyric = ref<string>('')
    const transLyric = ref<string>('')
    const romaLyric = ref<string>('')
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const hasLyrics = ref(false)

    const parseLRC = (lrcText: string): LyricLine[] => {
        if (!lrcText) return []

        const lines: LyricLine[] = []
        const lrcLines = lrcText.split('\n')

        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/
        const timeRegex2 = /\[(\d{2}):(\d{2}):(\d{2})\](.*)/

        for (const line of lrcLines) {
            const trimmedLine = line.trim()
            if (!trimmedLine) continue

            let match = trimmedLine.match(timeRegex)
            if (match) {
                const mins = parseInt(match[1], 10)
                const secs = parseInt(match[2], 10)
                const ms = match[3].length === 2
                    ? parseInt(match[3], 10) * 10
                    : parseInt(match[3], 10)
                const time = mins * 60 + secs + ms / 1000
                const text = match[4].trim()
                if (text) {
                    lines.push({ time, text })
                }
                continue
            }

            match = trimmedLine.match(timeRegex2)
            if (match) {
                const hours = parseInt(match[1], 10)
                const mins = parseInt(match[2], 10)
                const secs = parseInt(match[3], 10)
                const time = hours * 3600 + mins * 60 + secs
                const text = match[4].trim()
                if (text) {
                    lines.push({ time, text })
                }
            }
        }

        lines.sort((a, b) => a.time - b.time)
        return lines
    }

    const parseLyricsWithTranslation = (
        lrcText: string,
        transText?: string,
        romaText?: string
    ): LyricLine[] => {
        const mainLines = parseLRC(lrcText)

        if (!transText && !romaText) {
            return mainLines
        }

        const transLines = transText ? parseLRC(transText) : []
        const romaLines = romaText ? parseLRC(romaText) : []

        const transMap = new Map(transLines.map(l => [l.time, l.text]))
        const romaMap = new Map(romaLines.map(l => [l.time, l.text]))

        return mainLines.map(line => ({
            ...line,
            trans: transMap.get(line.time),
            roma: romaMap.get(line.time)
        }))
    }

    const fetchLyrics = async (
        songId: number | string,
        songName: string,
        artist: string,
    ): Promise<void> => {
        isLoading.value = true
        error.value = null
        hasLyrics.value = false
        currentLyrics.value = []

        try {
            // 使用网易云歌词 API
            const result: NeteaseLyricResult = await getNeteaseLyric(songId)

            console.log(`[Lyrics] ${songName} - ${artist}: code=${result.code}, hasLrc=${!!result.lrc?.lyric}`)

            if (result.code === 200) {
                if (result.lrc?.lyric) {
                    originalLyric.value = result.lrc.lyric
                    transLyric.value = result.tlyric?.lyric || ''
                    romaLyric.value = result.romalrc?.lyric || ''

                    currentLyrics.value = parseLyricsWithTranslation(
                        result.lrc.lyric,
                        result.tlyric?.lyric,
                        result.romalrc?.lyric
                    )

                    hasLyrics.value = currentLyrics.value.length > 0
                    console.log(`[Lyrics] ✅ 解析成功，共 ${currentLyrics.value.length} 行`)
                } else {
                    originalLyric.value = ''
                    transLyric.value = ''
                    romaLyric.value = ''
                    hasLyrics.value = false
                }
            } else {
                error.value = '获取歌词失败'
            }
        } catch (e) {
            error.value = e instanceof Error ? e.message : '获取歌词失败'
            console.error(`[Lyrics] ❌ 请求异常:`, e)
        } finally {
            isLoading.value = false
        }
    }

    const getCurrentLineIndex = (currentTime: number): number => {
        if (!currentLyrics.value.length) return -1

        for (let i = currentLyrics.value.length - 1; i >= 0; i--) {
            if (currentTime >= currentLyrics.value[i].time) {
                return i
            }
        }
        return -1
    }

    const clearLyrics = () => {
        currentLyrics.value = []
        originalLyric.value = ''
        transLyric.value = ''
        romaLyric.value = ''
        hasLyrics.value = false
        error.value = null
    }

    return {
        currentLyrics,
        originalLyric,
        transLyric,
        romaLyric,
        isLoading,
        error,
        hasLyrics,

        fetchLyrics,
        getCurrentLineIndex,
        clearLyrics,
        parseLRC,
        parseLyricsWithTranslation
    }
})
