<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    /** 顶部图标 */
    icon?: IconName
    /** 主文案 */
    title: string
    /** 补充说明，留空则不渲染 */
    description?: string
    /** 行动按钮文案，留空则不渲染 */
    actionText?: string
  }>(),
  { icon: 'search' },
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty-state">
    <AppIcon :name="icon" :size="28" />
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <button v-if="actionText" type="button" @click="emit('action')">{{ actionText }}</button>
  </div>
</template>
