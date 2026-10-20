<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from './base/AppIcon.vue'
import { formatCount } from '@/data/library'
import { useImageFallback } from '@/composables/useImageFallback'
import { usePromptActions } from '@/composables/usePromptActions'
import type { Prompt } from '@/types/prompt'

const props = defineProps<{ prompt: Prompt }>()

const router = useRouter()
const { onImageError } = useImageFallback()
const { copied, busy, isFavorite, copy, toggleFavorite, download } = usePromptActions(
  () => props.prompt,
)

/** 列表里没有正文，用主题 / 风格拼一行摘要 */
const summary = computed(() => {
  if (props.prompt.tags.length) return props.prompt.tags.join(' · ')
  return `${props.prompt.major} / ${props.prompt.category}`
})

function open(): void {
  void router.push({ name: 'prompt-detail', params: { id: props.prompt.id } })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') open()
}
</script>

<template>
  <article
    class="prompt-card grid-card"
    role="link"
    tabindex="0"
    :aria-label="`查看${prompt.title}详情`"
    @click="open"
    @keydown="onKeydown"
  >
    <div class="card-image grid-card-media">
      <img
        :src="prompt.image"
        :alt="prompt.title"
        loading="lazy"
        decoding="async"
        @error="onImageError($event, prompt.title, prompt.major)"
      />
      <span class="image-category">#{{ prompt.category }}</span>

      <div class="image-actions">
        <button
          class="image-action"
          :class="{ 'is-favorite': isFavorite }"
          type="button"
          :aria-label="isFavorite ? `取消收藏${prompt.title}` : `收藏${prompt.title}`"
          :aria-pressed="isFavorite"
          @click.stop="toggleFavorite"
        >
          <AppIcon name="heart" :size="16" />
        </button>
        <button
          class="image-action"
          :class="{ 'is-copied': copied, 'is-busy': busy }"
          type="button"
          :aria-label="`复制${prompt.title}提示词`"
          :disabled="busy"
          @click.stop="copy"
        >
          <AppIcon :name="copied ? 'check' : 'copy'" :size="15" />
        </button>
        <button
          class="image-action"
          type="button"
          :aria-label="`下载${prompt.title}图片`"
          @click.stop="download"
        >
          <AppIcon name="download" :size="15" />
        </button>
      </div>

      <span class="grid-card-arrow"><AppIcon name="chevron" :size="16" /></span>
    </div>

    <div class="grid-card-body">
      <h3>{{ prompt.title }}</h3>
      <p class="grid-card-desc">{{ summary }}</p>
      <div class="grid-card-foot">
        <span class="grid-card-author">{{ prompt.major }}</span>
        <span class="grid-card-stats">{{ formatCount(prompt.likes) }} 赞</span>
        <span class="grid-card-cat">{{ prompt.category }}</span>
      </div>
    </div>
  </article>
</template>
