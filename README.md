# ZLIX - 音乐播放器

一款基于 Electron + Vue 3 的现代化音乐播放器，支持多平台音乐源。

## 🎵 功能特点

- ✨ **多平台音乐支持**：支持网易云音乐、酷狗音乐等平台
- 🎶 **高品质音频播放**：基于 mpv 播放器，支持多种音频格式
- 🎨 **精美界面设计**：现代化的 UI 设计，支持深色/浅色主题
- 📝 **歌词显示**：支持桌面歌词和内置歌词显示
- ❤️ **收藏管理**：收藏喜欢的歌曲和歌单
- 🎧 **播放控制**：支持播放、暂停、音量调节等
- 📱 **响应式设计**：适配不同屏幕尺寸

## 📋 日志说明

### 日志位置

**Windows**:
```
%APPDATA%\ZLIX\logs\YYYY-MM-DD.log
```
或
```
C:\Users\<用户名>\AppData\Roaming\ZLIX\logs\YYYY-MM-DD.log
```

**macOS**:
```
~/Library/Logs/ZLIX/YYYY-MM-DD.log
```

**Linux**:
```
~/.config/ZLIX/logs/YYYY-MM-DD.log
```

### 开发环境日志

开发模式下，日志会额外输出到：
```
%APPDATA%\ZLIX\logs\dev\YYYY-MM-DD.log
```

### 日志级别

- `info` - 一般信息
- `warn` - 警告信息
- `error` - 错误信息
- `debug` - 调试信息（仅开发环境）

### 日志清除规则

应用会自动管理日志文件，避免日志文件过多占用磁盘空间：

- **保留天数**：默认保留最近 30 天的日志文件
- **单个文件大小限制**：每个日志文件最大 2MB
- **清理时机**：每次应用启动时自动清理过期日志

### 打开日志目录

在应用中可以通过以下方式打开日志目录：
```javascript
window.api.ipcRenderer.send('open-log-file')
```

## 🤝 贡献

本项目仅作者为了自学而实现，功能没有那么完善,只实现了必要的功能，后续改动也不会很大，大家如果想使用音乐软件可以使用致谢栏目的[EchoMusic](https://github.com/hoowhoami/EchoMusic)和[SPlayer](https://github.com/hoowhoami/EchoMusic)。

# 致谢
本项目参考并借鉴了以下项目的实现，非常感谢！！！

- [KuGouMusicApi](https://github.com/MakcRe/KuGouMusicApi)

- [neteasecloudmusicapienhanced](https://github.com/neteasecloudmusicapienhanced/api-enhanced)

- [EchoMusic](https://github.com/hoowhoami/EchoMusic)

- [SPlayer](https://github.com/imsyy/SPlayer)

# 免责声明
本项目部分功能使用了网易云音乐的第三方 API 服务以及公开 API 接口，**仅为本人自学技术实现，禁止用于商业及非法用途。**

同时，本项目开发者承诺 严格遵守相关法律法规和网易云音乐 API 使用协议，不会利用本项目进行任何违法活动。 如因使用本项目而引起的任何纠纷或责任，均由使用者自行承担。本项目开发者不承担任何因使用本项目而导致的任何直接或间接责任，并保留追究使用者违法行为的权利
