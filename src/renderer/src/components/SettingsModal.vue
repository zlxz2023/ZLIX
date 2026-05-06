<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore, type Theme } from '@renderer/stores/settings'

const props = defineProps<{
    visible: boolean
}>()

const settingsStore = useSettingsStore()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const activeTab = ref('theme')

const tabs = [
    { id: 'theme', name: '主题设置', icon: '🎨' },
    { id: 'lyrics', name: '歌词设置', icon: '🎵' }
]

const themeOptions: { value: Theme; label: string; desc: string }[] = [
    { value: 'light', label: '浅色', desc: '明亮清爽的浅色主题' },
    { value: 'dark', label: '深色', desc: '护眼的深色主题' },
    { value: 'system', label: '跟随系统', desc: '自动跟随系统设置' }
]

const close = () => {
    emit('close')
}
</script>

<template>
    <Teleport to="body">
        <div v-if="props.visible" class="settings-overlay" @click.self="close">
            <div class="settings-modal">
                <!-- 侧边栏 -->
                <div class="settings-sidebar">
                    <div class="sidebar-header">
                        <h2>设置</h2>
                    </div>
                    <div class="sidebar-tabs">
                        <button
                            v-for="tab in tabs"
                            :key="tab.id"
                            class="sidebar-tab"
                            :class="{ active: activeTab === tab.id }"
                            @click="activeTab = tab.id"
                        >
                            <span class="tab-icon">{{ tab.icon }}</span>
                            <span class="tab-name">{{ tab.name }}</span>
                        </button>
                    </div>
                </div>

                <!-- 内容区 -->
                <div class="settings-content">
                    <!-- 主题设置 -->
                    <div v-if="activeTab === 'theme'" class="settings-section">
                        <h3>主题选择</h3>
                        <div class="theme-options">
                            <div
                                v-for="option in themeOptions"
                                :key="option.value"
                                class="theme-option"
                                :class="{ active: settingsStore.theme === option.value }"
                                @click="settingsStore.theme = option.value"
                            >
                                <div class="theme-preview" :data-theme-preview="option.value">
                                    <div class="preview-header"></div>
                                    <div class="preview-content">
                                        <div class="preview-block"></div>
                                        <div class="preview-block"></div>
                                    </div>
                                </div>
                                <div class="theme-info">
                                    <span class="theme-label">{{ option.label }}</span>
                                    <span class="theme-desc">{{ option.desc }}</span>
                                </div>
                                <div v-if="settingsStore.theme === option.value" class="theme-check">✓</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 歌词设置 -->
                    <div v-if="activeTab === 'lyrics'" class="settings-section">
                        <h3>歌词样式</h3>

                        <!-- 预览区 -->
                        <div class="preview-section">
                            <label>预览</label>
                            <div class="lyrics-preview">
                                <div
                                    class="preview-current"
                                    :style="{
                                        color: settingsStore.lyricsCurrentColor,
                                        fontSize: settingsStore.lyricsFontSize + 'px'
                                    }"
                                >
                                    当前歌词这一行
                                </div>
                                <div
                                    class="preview-next"
                                    :style="{
                                        color: settingsStore.lyricsNextColor,
                                        fontSize: settingsStore.lyricsNextFontSize + 'px'
                                    }"
                                >
                                    下一句歌词这一行
                                </div>
                            </div>
                        </div>

                        <!-- 已播放文字颜色 -->
                        <div class="setting-item">
                            <label>已播放文字</label>
                            <div class="setting-sub-label">桌面歌词已播放文字颜色</div>
                            <div class="color-picker-wrapper">
                                <input
                                    type="color"
                                    v-model="settingsStore.lyricsCurrentColor"
                                    class="color-input-large"
                                />
                                <span class="color-value">{{ settingsStore.lyricsCurrentColor }}</span>
                            </div>
                        </div>

                        <!-- 未播放文字颜色 -->
                        <div class="setting-item">
                            <label>未播放文字</label>
                            <div class="setting-sub-label">桌面歌词未播放文字颜色</div>
                            <div class="color-picker-wrapper">
                                <input
                                    type="color"
                                    v-model="settingsStore.lyricsNextColor"
                                    class="color-input-large"
                                />
                                <span class="color-value">{{ settingsStore.lyricsNextColor }}</span>
                            </div>
                        </div>

                        <!-- 当前歌词字体大小 -->
                        <div class="setting-item">
                            <label>当前歌词字体大小: {{ settingsStore.lyricsFontSize }}px</label>
                            <input
                                type="range"
                                min="20"
                                max="48"
                                v-model.number="settingsStore.lyricsFontSize"
                                class="range-input"
                            />
                        </div>

                        <!-- 下一句歌词字体大小 -->
                        <div class="setting-item">
                            <label>下一句歌词字体大小: {{ settingsStore.lyricsNextFontSize }}px</label>
                            <input
                                type="range"
                                min="12"
                                max="32"
                                v-model.number="settingsStore.lyricsNextFontSize"
                                class="range-input"
                            />
                        </div>
                    </div>
                </div>

                <!-- 关闭按钮 -->
                <button class="close-btn" @click="close">✕</button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    user-select: none;
}

.settings-modal {
    width: 800px;
    height: 550px;
    background-color: #ffffff;
    border-radius: 12px;
    display: flex;
    overflow: hidden;
    position: relative;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

html:not([data-theme="light"]) .settings-modal {
    background-color: #1a1a2e;
}

.settings-sidebar {
    width: 200px;
    background-color: #f5f5f5;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
}

html:not([data-theme="light"]) .settings-sidebar {
    background-color: #16213e;
    border-right-color: #252545;
}

.sidebar-header {
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
}

html:not([data-theme="light"]) .sidebar-header {
    border-bottom-color: #252545;
}

.sidebar-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

html:not([data-theme="light"]) .sidebar-header h2 {
    color: #ffffff;
}

.sidebar-tabs {
    flex: 1;
    padding: 10px;
}

.sidebar-tab {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s;
    text-align: left;
}

html:not([data-theme="light"]) .sidebar-tab {
    color: #9ca3af;
}

.sidebar-tab:hover {
    background-color: #e8e8e8;
    color: #333;
}

html:not([data-theme="light"]) .sidebar-tab:hover {
    background-color: #252545;
    color: #ffffff;
}

.sidebar-tab.active {
    background-color: #e8e8e8;
    color: #333;
    font-weight: 500;
}

html:not([data-theme="light"]) .sidebar-tab.active {
    background-color: #252545;
    color: #ffffff;
}

.tab-icon {
    font-size: 18px;
}

.tab-name {
    font-size: 14px;
}

.settings-content {
    flex: 1;
    padding: 20px 30px;
    overflow-y: auto;
    background-color: #f8f8f8;
}

html:not([data-theme="light"]) .settings-content {
    background-color: #1a1a2e;
}

.settings-section h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
}

html:not([data-theme="light"]) .settings-section h3 {
    color: #ffffff;
}

.theme-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.theme-option {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: #ffffff;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

html:not([data-theme="light"]) .theme-option {
    background: #252545;
    border-color: #3a3a5a;
}

.theme-option:hover {
    border-color: #c0c0c0;
    background: #fafafa;
}

html:not([data-theme="light"]) .theme-option:hover {
    border-color: #4a4a6a;
    background: #2c2c4f;
}

.theme-option.active {
    border-color: #ff3355;
    background: #fff5f7;
}

html:not([data-theme="light"]) .theme-option.active {
    border-color: #ff3355;
    background: rgba(255, 51, 85, 0.1);
}

.theme-preview {
    width: 80px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
}

[data-theme-preview="light"] {
    background: linear-gradient(180deg, #f5f7fa 40%, #ffffff 40%);
}

[data-theme-preview="dark"] {
    background: linear-gradient(180deg, #1a1a2e 40%, #16213e 40%);
}

[data-theme-preview="system"] {
    background: linear-gradient(90deg, #f5f7fa 50%, #1a1a2e 50%);
}

.preview-header {
    height: 40%;
}

.preview-content {
    height: 60%;
    display: flex;
    gap: 6px;
    padding: 8px;
}

[data-theme-preview="light"] .preview-block {
    background: #e0e0e0;
}

[data-theme-preview="dark"] .preview-block {
    background: #252545;
}

[data-theme-preview="system"] .preview-block:nth-child(1) {
    background: #e0e0e0;
}

[data-theme-preview="system"] .preview-block:nth-child(2) {
    background: #252545;
}

.preview-block {
    flex: 1;
    border-radius: 4px;
}

.theme-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.theme-label {
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

html:not([data-theme="light"]) .theme-label {
    color: #ffffff;
}

.theme-desc {
    font-size: 13px;
    color: #999;
}

html:not([data-theme="light"]) .theme-desc {
    color: #9ca3af;
}

.theme-check {
    width: 24px;
    height: 24px;
    background: #ff3355;
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    flex-shrink: 0;
}

.preview-section {
    margin-bottom: 24px;
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
}

html:not([data-theme="light"]) .preview-section {
    background: #252545;
    border-color: #3a3a5a;
}

.preview-section label {
    display: block;
    margin-bottom: 12px;
    font-size: 14px;
    color: #333;
    font-weight: 500;
}

html:not([data-theme="light"]) .preview-section label {
    color: #ffffff;
}

.lyrics-preview {
    background-color: #ffffff;
    padding: 20px;
    text-align: center;
}

html:not([data-theme="light"]) .lyrics-preview {
    background-color: #252545;
}

.preview-current {
    margin-bottom: 8px;
    font-weight: 600;
}

.preview-next {
    opacity: 0.7;
}

.setting-item {
    margin-bottom: 24px;
    background: #ffffff;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
}

html:not([data-theme="light"]) .setting-item {
    background: #252545;
    border-color: #3a3a5a;
}

.setting-item label {
    display: block;
    margin-bottom: 6px;
    font-size: 16px;
    color: #333;
    font-weight: 500;
}

html:not([data-theme="light"]) .setting-item label {
    color: #ffffff;
}

.setting-sub-label {
    font-size: 13px;
    color: #999;
    margin-bottom: 12px;
}

html:not([data-theme="light"]) .setting-sub-label {
    color: #9ca3af;
}

.color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
}

.color-input-large {
    width: 200px;
    height: 40px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.color-value {
    font-size: 14px;
    color: #666;
    font-family: monospace;
    background: #f0f0f0;
    padding: 6px 12px;
    border-radius: 4px;
}

.range-input {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: #e0e0e0;
    appearance: none;
    cursor: pointer;
}

.range-input::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ff3355;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    border-radius: 6px;
    font-size: 16px;
    transition: all 0.2s;
}

.close-btn:hover {
    background-color: #f0f0f0;
    color: #333;
}
</style>
