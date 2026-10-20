<script setup lang="ts">
import { computed } from 'vue'
import { iconPaths, type IconName } from './icons'

const props = withDefaults(
  defineProps<{
    /** 图标名称，取值见 icons.ts */
    name: IconName
    /** 图标尺寸（像素），默认 18 */
    size?: number
  }>(),
  { size: 18 },
)

const markup = computed(() => iconPaths[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="markup"
  ></svg>
</template>
