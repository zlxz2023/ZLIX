import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const api = (window as any).api

export type Theme = 'light' | 'dark' | 'system'

export const useSettingsStore = defineStore('settings', () => {
    // 歌词设置
    const lyricsCurrentColor = ref('#ff3355') // 当前歌词颜色（红色）
    const lyricsNextColor = ref('rgba(255, 255, 255, 0.4)') // 下一句歌词颜色（模糊）
    const lyricsSongInfoColor = ref('#ff3355') // 无歌词时显示的歌曲信息颜色
    const lyricsFontSize = ref(32) // 当前歌词字体大小
    const lyricsNextFontSize = ref(20) // 下一句歌词字体大小

    // 主题设置
    const theme = ref<Theme>('system') // 默认跟随系统

    // 从 localStorage 恢复设置
    const savedSettings = localStorage.getItem('lyrics-settings')
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings)
            if (parsed.lyricsCurrentColor) lyricsCurrentColor.value = parsed.lyricsCurrentColor
            if (parsed.lyricsNextColor) lyricsNextColor.value = parsed.lyricsNextColor
            if (parsed.lyricsSongInfoColor) lyricsSongInfoColor.value = parsed.lyricsSongInfoColor
            if (parsed.lyricsFontSize) lyricsFontSize.value = parsed.lyricsFontSize
            if (parsed.lyricsNextFontSize) lyricsNextFontSize.value = parsed.lyricsNextFontSize
            if (parsed.theme) theme.value = parsed.theme
        } catch (e) {
            console.warn('恢复歌词设置失败:', e)
        }
    }

    // 发送设置到歌词窗口
    const syncSettingsToLyrics = () => {
        if (api?.lyricsWindow?.sendSettingsUpdate) {
            api.lyricsWindow.sendSettingsUpdate({
                lyricsCurrentColor: lyricsCurrentColor.value,
                lyricsNextColor: lyricsNextColor.value,
                lyricsSongInfoColor: lyricsSongInfoColor.value,
                lyricsFontSize: lyricsFontSize.value,
                lyricsNextFontSize: lyricsNextFontSize.value
            })
        }
    }

    // 监听变化并保存，同时同步到歌词窗口
    watch(
        [lyricsCurrentColor, lyricsNextColor, lyricsSongInfoColor, lyricsFontSize, lyricsNextFontSize, theme],
        () => {
            localStorage.setItem('lyrics-settings', JSON.stringify({
                lyricsCurrentColor: lyricsCurrentColor.value,
                lyricsNextColor: lyricsNextColor.value,
                lyricsSongInfoColor: lyricsSongInfoColor.value,
                lyricsFontSize: lyricsFontSize.value,
                lyricsNextFontSize: lyricsNextFontSize.value,
                theme: theme.value
            }))
            // 实时同步到歌词窗口
            syncSettingsToLyrics()
        },
        { deep: true }
    )

    return {
        lyricsCurrentColor,
        lyricsNextColor,
        lyricsSongInfoColor,
        lyricsFontSize,
        lyricsNextFontSize,
        theme
    }
})