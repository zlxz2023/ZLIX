<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface VideoPlayerProps {
  visible: boolean
  videoUrl: string
  title: string
}

const props = defineProps<VideoPlayerProps>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

const handleClose = () => {
  if (videoRef.value) {
    videoRef.value.pause()
  }
  emit('close')
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.visible) return
  if (e.code === 'Escape') {
    handleClose()
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal && videoRef.value) {
    videoRef.value.currentTime = 0
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
        @click.self="handleClose"
      >
        <div class="w-full max-w-5xl max-h-[90vh] mx-4 flex flex-col items-center">
          <!-- 标题 -->
          <div class="text-white text-center mb-4">
            <h3 class="text-xl font-medium">{{ title }}</h3>
          </div>
          
          <!-- 原生 HTML5 视频播放器 -->
          <video
            ref="videoRef"
            :src="videoUrl"
            class="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            controls
            autoplay
            playsinline
            @ended="handleClose"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

video {
  background: black;
}
</style>