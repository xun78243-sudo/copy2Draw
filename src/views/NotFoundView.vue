<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  /** 标题 */
  title?: string
  /** 说明文案 */
  description?: string
}>()

const homeRoute: RouteLocationRaw = { name: 'home' }
</script>

<template>
  <main class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-8 py-16 text-center">
    <p class="text-xs font-bold uppercase tracking-[0.22em] text-violet-600">404</p>
    <h1 class="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">
      {{ title ?? '页面不存在' }}
    </h1>
    <p class="mt-4 text-zinc-600">
      {{ description ?? '你访问的页面不存在，或者已经被移动。' }}
    </p>
    <RouterLink
      class="mt-6 font-medium text-violet-600 underline-offset-4 hover:underline"
      :to="homeRoute"
    >
      ← 返回提示词库
    </RouterLink>
  </main>
</template>
