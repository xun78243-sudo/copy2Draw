<script setup lang="ts">
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

function open(): void {
  void router.push({ name: 'prompt-detail', params: { id: props.prompt.id } })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') open()
}
</script>

<template>
  <article
    class="prompt-card compact-card"
    role="link"
    tabindex="0"
    :aria-label="`查看${prompt.title}详情`"
    @click="open"
    @keydown="onKeydown"
  >
    <div class="card-image">
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
          <AppIcon name="heart" :size="17" />
        </button>
        <button
          class="image-action"
          :class="{ 'is-copied': copied, 'is-busy': busy }"
          type="button"
          :aria-label="`复制${prompt.title}提示词`"
          :disabled="busy"
          @click.stop="copy"
        >
          <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />
        </button>
        <button
          class="image-action"
          type="button"
          :aria-label="`下载${prompt.title}图片`"
          @click.stop="download"
        >
          <AppIcon name="download" :size="16" />
        </button>
      </div>
    </div>

    <div class="card-body">
      <div class="card-meta">
        <span>{{ prompt.major }}</span>
        <span><AppIcon name="heart" :size="13" /> {{ formatCount(prompt.likes) }}</span>
      </div>
      <h3>{{ prompt.title }}</h3>
      <div class="card-foot">
        <div>
          <span v-for="tag in prompt.tags.slice(0, 2)" :key="tag">#{{ tag }}</span>
        </div>
        <button type="button" aria-label="查看详情" @click.stop="open">
          <AppIcon name="chevron" :size="17" />
        </button>
      </div>
    </div>
  </article>
</template>
