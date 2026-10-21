<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import EmptyState from '@/components/base/EmptyState.vue'
import HeroSection from '@/components/HeroSection.vue'
import PromptMasonryCard from '@/components/PromptMasonryCard.vue'
import heroBg from '@/assets/images/home-hero-bg.png'
import { dailySeed, matchesQuery, seededOrder } from '@/data/library'
import { useLibraryStore } from '@/stores/library'
import type { Prompt } from '@/types/prompt'

/** 每日精选展示条数 */
const DAILY_COUNT = 12

const library = useLibraryStore()

const query = ref('')
/** 以本地日历日为种子：每天换一批；跨天自动回到第一组 */
const dayIndex = ref(dailySeed())
const group = ref(0)
/** 当天池子能切出的「换一批」组数 */
const dailyGroupCount = computed(() =>
  Math.max(Math.ceil((library.featuredPool.length || 0) / DAILY_COUNT), 1),
)

/** 首页快捷入口：按提示词数量取前 8 个大类 */
const shortcuts = computed(() =>
  [...(library.meta?.majors ?? [])].sort((a, b) => b.count - a.count).slice(0, 8),
)

/** 无关键词时按当天种子打乱「高赞精选池」取一组；有关键词时在全库里按点赞排序取前 N 条 */
const dailyPrompts = computed<readonly Prompt[]>(() => {
  const needle = query.value.trim().toLowerCase()
  if (needle) {
    return [...library.items.filter((item) => matchesQuery(item, needle))]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, DAILY_COUNT)
  }
  const pool = library.featuredPool
  if (!pool.length) return []
  const order = seededOrder(pool.length, dayIndex.value)
  const start = (group.value * DAILY_COUNT) % order.length
  const indices = [...order.slice(start), ...order.slice(0, start)].slice(0, DAILY_COUNT)
  return indices.map((index) => pool[index])
})

/** 搜索命中的总数，用于提示「只展示了前 12 条」 */
const matchedTotal = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return 0
  return library.items.filter((item) => matchesQuery(item, needle)).length
})

const searching = computed(() => Boolean(query.value.trim()))
const initializing = computed(() => !library.loaded && !library.error)

let dayTimer: number | undefined

onMounted(() => {
  void library.ensureLoaded().catch(() => {
    // 失败信息已写入 store.error，由模板展示重试入口
  })
  // 页面跨天时自动切到新一天的批次
  dayTimer = window.setInterval(() => {
    const today = dailySeed()
    if (today !== dayIndex.value) {
      dayIndex.value = today
      group.value = 0
    }
  }, 60_000)
})

onUnmounted(() => {
  if (dayTimer !== undefined) window.clearInterval(dayTimer)
})

/** 「换一批」：切到当天种子打乱后的下一组 */
function shuffle(): void {
  group.value = (group.value + 1) % dailyGroupCount.value
}

function scrollToResults(): void {
  document.getElementById('daily-results')?.scrollIntoView({ behavior: 'smooth' })
}

function clearSearch(): void {
  query.value = ''
}

function retry(): void {
  void library.ensureLoaded().catch(() => {})
}
</script>

<template>
  <div class="home">
    <div class="home-hero-bg" aria-hidden="true">
      <img :src="heroBg" alt="" />
    </div>

    <div id="library" class="content">
      <HeroSection
        v-model:query="query"
        :total="library.total"
        :major-count="library.meta?.majors.length ?? 0"
        :sub-count="library.subCategoryCount"
        :majors="shortcuts"
        @search="scrollToResults"
      />

      <section id="daily-results" class="results daily-results">
        <div class="results-head">
          <div>
            <h2>{{ searching ? '搜索结果' : '今日灵感' }}</h2>
            <span v-if="searching">
              命中 {{ matchedTotal }} 条，按点赞展示前 {{ dailyPrompts.length }} 条
            </span>
            <span v-else>每天更新一组 · 从 {{ library.featuredPool.length }} 条高赞提示词里精选</span>
          </div>
          <button v-if="!searching" class="shuffle-btn" type="button" @click="shuffle">
            <span>↻</span> 换一批
          </button>
          <RouterLink v-else class="shuffle-btn" :to="{ name: 'discover', query: { q: query } }">
            在发现页查看全部 →
          </RouterLink>
        </div>

        <div v-if="initializing" class="masonry-grid daily-masonry" aria-hidden="true">
          <div v-for="n in 6" :key="n" class="skeleton-card" :class="`skeleton-h${(n % 3) + 1}`" />
        </div>

        <EmptyState
          v-else-if="library.error"
          icon="image"
          title="数据加载失败"
          :description="library.error"
          action-text="重新加载"
          @action="retry"
        />

        <div v-else-if="dailyPrompts.length" class="masonry-grid daily-masonry">
          <PromptMasonryCard v-for="item in dailyPrompts" :key="item.id" :prompt="item" />
        </div>

        <EmptyState
          v-else
          title="没有找到相关灵感"
          description="换个关键词试试，或者到发现页按分类浏览。"
          action-text="清除搜索"
          @action="clearSearch"
        />
      </section>
    </div>
  </div>
</template>
