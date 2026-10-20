<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CategoryFilterTabs, { type FilterTab } from '@/components/CategoryFilterTabs.vue'
import EmptyState from '@/components/base/EmptyState.vue'
import FloatingSearch from '@/components/FloatingSearch.vue'
import PromptGridCard from '@/components/PromptGridCard.vue'
import { filterPrompts } from '@/data/library'
import { useIncrementalList } from '@/composables/useIncrementalList'
import { useLibraryStore } from '@/stores/library'

/** 会写入 URL 的筛选维度；空字符串代表「不限制」 */
const FILTER_KEYS = ['major', 'category', 'theme', 'style', 'q'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()

/** 从 URL 读一个筛选值，缺省为空字符串 */
function readParam(key: FilterKey): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

const major = computed(() => readParam('major'))
const category = computed(() => readParam('category'))
const theme = computed(() => readParam('theme'))
const style = computed(() => readParam('style'))

/** 关键词与 URL 的 q 参数双向同步（replace 不产生历史记录） */
const query = computed({
  get: () => readParam('q'),
  set: (value: string) => update({ q: value }, false),
})

/** 写入筛选条件；未出现在 patch 里的维度保持不变 */
function update(patch: Partial<Record<FilterKey, string>>, push = true): void {
  const next: Record<string, string> = {}
  for (const key of FILTER_KEYS) {
    const value = key in patch ? (patch[key] ?? '') : readParam(key)
    if (value) next[key] = value
  }
  const location = { name: 'discover' as const, query: next }
  void (push ? router.push(location) : router.replace(location))
}

const tabs = computed<FilterTab[]>(() => [
  { label: '全部', value: '' },
  ...(library.meta?.majors ?? []).map((entry) => ({
    label: entry.name,
    value: entry.name,
    count: entry.count,
  })),
])

/** 选中大类时清空细分类，因为细分类隶属某个大类 */
function selectMajor(value: string): void {
  update({ major: value, category: '' })
}

function selectTheme(value: string): void {
  update({ theme: value }, false)
}

function selectStyle(value: string): void {
  update({ style: value }, false)
}

function selectCategory(value: string): void {
  update({ category: value })
}

/** 当前大类下的细分类，用作第三层筛选 */
const subOptions = computed(() => (major.value ? library.subsOf(major.value) : []))

const filtered = computed(() =>
  filterPrompts(library.items, {
    major: major.value,
    category: category.value,
    theme: theme.value,
    style: style.value,
    query: query.value,
  }),
)

const { visible, remaining, hasMore, loadMore } = useIncrementalList(filtered)

const heading = computed(() => {
  if (query.value.trim()) return '搜索结果'
  if (category.value) return category.value
  if (major.value) return `${major.value}灵感`
  return '为你推荐'
})

const subtitle = computed(() => {
  if (query.value.trim()) return `与「${query.value.trim()}」相关`
  if (category.value) return `所属大类：${major.value}`
  return '全库按收录顺序排列'
})

const hasFilters = computed(() =>
  Boolean(major.value || category.value || theme.value || style.value || query.value.trim()),
)

const initializing = computed(() => !library.loaded && !library.error)

onMounted(() => {
  void library.ensureLoaded().catch(() => {})
})

/* 滚动到底自动追加一批，同时保留「加载更多」按钮作为兜底 */
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined

watch(
  sentinel,
  (element) => {
    observer?.disconnect()
    if (element) observer?.observe(element)
  },
  { flush: 'post' },
)

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    },
    { rootMargin: '800px 0px' },
  )
  // 数据已就绪、哨兵已在 DOM 上时，补一次 observe
  if (sentinel.value) observer.observe(sentinel.value)
})

onBeforeUnmount(() => observer?.disconnect())

function clearFilters(): void {
  void router.push({ name: 'discover' })
}

function retry(): void {
  void library.ensureLoaded().catch(() => {})
}
</script>

<template>
  <div id="library" class="content">
    <h1 class="sr-only">发现提示词</h1>

    <section class="filter-bar" aria-label="按大类筛选">
      <CategoryFilterTabs :tabs="tabs" :active="major" @select="selectMajor" />
      <span class="filter-count">{{ filtered.length }} 个提示词</span>
    </section>

    <div v-if="library.loaded" class="facet-bar">
      <div class="facet-row">
        <span class="facet-label">主题</span>
        <button
          class="facet-chip"
          :class="{ 'is-active': !theme }"
          type="button"
          @click="selectTheme('')"
        >
          全部
        </button>
        <button
          v-for="option in library.themeOptions"
          :key="option.label"
          class="facet-chip"
          :class="{ 'is-active': theme === option.label }"
          type="button"
          :aria-pressed="theme === option.label"
          @click="selectTheme(theme === option.label ? '' : option.label)"
        >
          {{ option.label }}<small>{{ option.count }}</small>
        </button>
      </div>

      <div class="facet-row">
        <span class="facet-label">风格</span>
        <button
          class="facet-chip"
          :class="{ 'is-active': !style }"
          type="button"
          @click="selectStyle('')"
        >
          全部
        </button>
        <button
          v-for="option in library.styleOptions"
          :key="option.label"
          class="facet-chip"
          :class="{ 'is-active': style === option.label }"
          type="button"
          :aria-pressed="style === option.label"
          @click="selectStyle(style === option.label ? '' : option.label)"
        >
          {{ option.label }}<small>{{ option.count }}</small>
        </button>
      </div>

      <div v-if="subOptions.length" class="facet-row">
        <span class="facet-label">细分类</span>
        <button
          class="facet-chip"
          :class="{ 'is-active': !category }"
          type="button"
          @click="selectCategory('')"
        >
          全部
        </button>
        <button
          v-for="option in subOptions"
          :key="option.name"
          class="facet-chip"
          :class="{ 'is-active': category === option.name }"
          type="button"
          :aria-pressed="category === option.name"
          @click="selectCategory(category === option.name ? '' : option.name)"
        >
          {{ option.name }}<small>{{ option.count }}</small>
        </button>
      </div>
    </div>

    <section class="results discover-results">
      <div class="results-head">
        <div>
          <h2>{{ heading }}</h2>
          <span>{{ subtitle }}</span>
        </div>
        <button v-if="hasFilters" class="shuffle-btn" type="button" @click="clearFilters">
          清除筛选
        </button>
      </div>

      <div v-if="initializing" class="prompt-grid" aria-hidden="true">
        <div v-for="n in 10" :key="n" class="skeleton-card skeleton-h2" />
      </div>

      <EmptyState
        v-else-if="library.error"
        icon="image"
        title="数据加载失败"
        :description="library.error"
        action-text="重新加载"
        @action="retry"
      />

      <template v-else-if="visible.length">
        <div class="prompt-grid">
          <PromptGridCard v-for="item in visible" :key="item.id" :prompt="item" />
        </div>

        <div v-if="hasMore" ref="sentinel" class="load-more-wrap">
          <button class="load-more" type="button" @click="loadMore">
            加载更多（剩余 {{ remaining }} 条）
          </button>
        </div>
      </template>

      <EmptyState
        v-else
        title="没有找到相关提示词"
        description="试试其他关键词、分类或分面。"
        action-text="清除筛选"
        @action="clearFilters"
      />
    </section>

    <FloatingSearch v-model:query="query" />
  </div>
</template>
