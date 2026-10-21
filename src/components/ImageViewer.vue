<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppIcon from './base/AppIcon.vue'
import { useImageFallback } from '@/composables/useImageFallback'

const props = defineProps<{
  src: string
  alt?: string
  label?: string
  major?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { onImageError } = useImageFallback()

onMounted(() => {
  // 打开期间锁定背景滚动
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="image-viewer"
      role="dialog"
      aria-modal="true"
      :aria-label="`查看大图：${alt ?? label ?? '图片'}`"
      @click="emit('close')"
    >
      <img
        :src="src"
        :alt="alt ?? label ?? '图片'"
        class="viewer-img"
        @error="onImageError($event, label ?? alt ?? '图', major)"
      />
      <button class="viewer-close" type="button" aria-label="关闭大图" @click="emit('close')">
        <AppIcon name="close" :size="18" />
      </button>
      <a class="viewer-link" :href="src" target="_blank" rel="noopener">原图 ↗</a>
    </div>
  </Teleport>
</template>

<style scoped>
.image-viewer {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(17 14 28 / 0.88);
  backdrop-filter: blur(10px);
  animation: viewer-fade-in 0.18s ease;
}
@keyframes viewer-fade-in {
  from {
    opacity: 0;
  }
}

.viewer-img {
  max-width: 92vw;
  max-height: 88vh;
  border-radius: 10px;
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.45);
}

.viewer-close {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 0.22);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.12);
  color: #fff;
  backdrop-filter: blur(8px);
  transition: background 0.18s ease, transform 0.18s ease;
}
.viewer-close:hover {
  background: rgb(255 255 255 / 0.24);
  transform: translateY(-1px);
}

.viewer-link {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border: 1px solid rgb(255 255 255 / 0.2);
  border-radius: 999px;
  background: rgb(30 26 42 / 0.55);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  backdrop-filter: blur(10px);
  transition: background 0.18s ease;
}
.viewer-link:hover {
  background: rgb(255 255 255 / 0.16);
}
</style>
