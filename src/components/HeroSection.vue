<script setup lang="ts">
import AppIcon from './base/AppIcon.vue'
import { formatTotal } from '@/data/library'

export interface HeroMajor {
  name: string
  count: number
  main: string
}

defineProps<{
  query: string
  /** 全库提示词总量 */
  total: number
  /** 大类数量 */
  majorCount: number
  /** 细分类数量 */
  subCount: number
  /** 首页快捷入口用的大类列表 */
  majors: HeroMajor[]
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  search: []
}>()

function onInput(event: Event): void {
  emit('update:query', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="hero">
    <div class="eyebrow"><span /><b>复制即画 · Copy2Draw</b></div>
    <h1>好词随手复制<br /><em>好画即刻生成</em></h1>
    <p>
      {{ formatTotal(total) }} 条中文 AI 绘画提示词，每条配生成效果图。无需登录，找到喜欢的内容，一键复制，即刻创作。
    </p>

    <div class="hero-search">
      <AppIcon name="search" :size="21" />
      <input
        :value="query"
        placeholder="试试搜索「电影感」或「赛博」"
        aria-label="搜索提示词"
        @input="onInput"
        @keydown.enter="emit('search')"
      />
      <button type="button" @click="emit('search')">搜索</button>
    </div>

    <div class="hero-stats">
      <div><strong>{{ formatTotal(total) }}</strong><span>条提示词</span></div>
      <i />
      <div><strong>{{ majorCount }} / {{ subCount }}</strong><span>大类 / 细分类</span></div>
      <i />
      <div><strong>每日</strong><span>持续收录</span></div>
    </div>

    <nav v-if="majors.length" class="hero-tags" aria-label="按大类浏览">
      <RouterLink
        v-for="major in majors"
        :key="major.name"
        class="hero-tag"
        :to="{ name: 'discover', query: { major: major.name } }"
      >
        <span class="category-dot" :style="{ background: major.main }" />
        {{ major.name }}
        <small>{{ major.count }}</small>
      </RouterLink>
      <RouterLink class="hero-tag is-more" :to="{ name: 'discover' }">全部 →</RouterLink>
    </nav>
  </section>
</template>
