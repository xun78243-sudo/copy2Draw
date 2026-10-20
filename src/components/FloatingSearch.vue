<script setup lang="ts">
import AppIcon from './base/AppIcon.vue'
import { useUiStore } from '@/stores/ui'

defineProps<{ query: string }>()

const emit = defineEmits<{ 'update:query': [value: string] }>()

const ui = useUiStore()

function onInput(event: Event): void {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="floating-search" :class="{ 'is-hidden': ui.mobileNavOpen }">
    <AppIcon name="search" :size="18" />
    <input
      :value="query"
      placeholder="搜索标题、提示词或标签"
      aria-label="搜索提示词"
      @input="onInput"
    />
    <button
      v-if="query"
      class="floating-clear"
      type="button"
      aria-label="清除搜索"
      @click="emit('update:query', '')"
    >
      <AppIcon name="close" :size="14" />
    </button>
  </div>
</template>
