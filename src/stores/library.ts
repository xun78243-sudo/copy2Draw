import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type {
  LibraryMeta,
  Prompt,
  PromptDetail,
  PromptDetailRaw,
  PromptRecordRaw,
  SubCategoryEntry,
} from '@/types/prompt'
import { DATA_BASE, countFacet, toPrompt, toPromptDetail } from '@/data/library'

/**
 * 提示词库数据仓库。
 *
 * 分层加载，与上游项目保持一致的策略：
 * 1. 首屏：`meta.json` + `categories.json` + `list.part1~3.json`（约 1.4 MB，无正文）
 * 2. 按需：`prompts.part1~3.json`（约 10 MB，含正文），只在打开详情或复制时拉取一次
 *
 * 两份数据都以模块级 Promise 缓存，重复调用不会重复请求。
 */

/** 分片数缺省值；实际数量由 meta.json 的 shards 字段决定（见 scripts/build-data.mjs） */
const DEFAULT_SHARDS = 3

/** 生成分片文件名：list.part1.json … / prompts.part1.json … */
function partNames(prefix: 'list' | 'prompts', shards: number): string[] {
  return Array.from({ length: Math.max(1, shards) }, (_, index) => `${prefix}.part${index + 1}.json`)
}

/** 首页「每日精选」的候选池大小：点赞数最高的一批 */
const FEATURED_POOL_SIZE = 120

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${file}`)
  if (!response.ok) throw new Error(`数据加载失败：${file}（HTTP ${response.status}）`)
  return (await response.json()) as T
}

export const useLibraryStore = defineStore('library', () => {
  /** 原始分类结构：细分类 → 数量 / 所属大类 */
  const categories = ref<Record<string, SubCategoryEntry>>({})
  const meta = ref<LibraryMeta | null>(null)
  /** 5430 条列表数据，用 shallowRef 避免为每条创建深层响应式代理 */
  const items = shallowRef<Prompt[]>([])

  const loading = ref(false)
  const fullTextLoading = ref(false)
  const error = ref('')

  let listPromise: Promise<void> | null = null
  let fullPromise: Promise<void> | null = null
  /** id → 完整正文；单独存放，避免把 10 MB 正文塞进列表项 */
  const textById = shallowRef<Map<number, string>>(new Map())
  const fullLoaded = ref(false)
  /** 已构造过的详情模型缓存 */
  const detailCache = new Map<number, PromptDetail>()

  const loaded = computed(() => items.value.length > 0)
  const total = computed(() => items.value.length || meta.value?.total || 0)
  const subCategoryCount = computed(
    () => meta.value?.subCount ?? Object.keys(categories.value).length,
  )
  const majorNames = computed(() => (meta.value?.majors ?? []).map((major) => major.name))
  const hotTags = computed(() => meta.value?.hot ?? [])
  const themeOptions = computed(() => countFacet(items.value, 'themes'))
  const styleOptions = computed(() => countFacet(items.value, 'styles'))

  /** 按点赞排序的精选候选池 */
  const featuredPool = computed(() =>
    [...items.value].sort((a, b) => b.likes - a.likes).slice(0, FEATURED_POOL_SIZE),
  )

  const indexById = computed(() => new Map(items.value.map((item) => [item.id, item])))

  /** 大类配色，图片兜底渐变与分类圆点共用 */
  function paletteOf(name: string): { main: string; bg: string } {
    const color = meta.value?.colors?.[name]
    return { main: color?.main ?? '#9a93a8', bg: color?.bg ?? '#e7e3ec' }
  }

  function subsOf(major: string): { name: string; count: number }[] {
    return meta.value?.majors.find((entry) => entry.name === major)?.subs ?? []
  }

  function countOfMajor(major: string): number {
    return meta.value?.majors.find((entry) => entry.name === major)?.count ?? 0
  }

  function countOfCategory(category: string): number {
    return categories.value[category]?.count ?? 0
  }

  function majorOfCategory(category: string): string {
    return categories.value[category]?.major ?? '其他/未归类'
  }

  function getById(id: number): Prompt | undefined {
    return indexById.value.get(id)
  }

  /** 首屏数据，幂等；失败后允许重试 */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    if (!listPromise) {
      listPromise = loadList().catch((cause: unknown) => {
        listPromise = null
        throw cause
      })
    }
    await listPromise
  }

  async function loadList(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const [metaJson, categoryJson] = await Promise.all([
        fetchJson<LibraryMeta>('meta.json'),
        fetchJson<Record<string, SubCategoryEntry>>('categories.json'),
      ])
      meta.value = metaJson
      categories.value = categoryJson
      const parts = await Promise.all(
        partNames('list', metaJson.shards ?? DEFAULT_SHARDS).map((part) =>
          fetchJson<PromptRecordRaw[]>(part),
        ),
      )
      items.value = parts.flat().map((raw) => toPrompt(raw, majorOfCategory))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  /** 完整正文，幂等；只在详情 / 复制时触发一次 */
  async function ensureFullText(): Promise<void> {
    if (fullLoaded.value) return
    if (!fullPromise) {
      fullPromise = loadFullText().catch((cause: unknown) => {
        fullPromise = null
        throw cause
      })
    }
    await fullPromise
  }

  async function loadFullText(): Promise<void> {
    fullTextLoading.value = true
    try {
      // 正文分片数量同样来自 meta；首屏未加载时先补齐
      if (!meta.value) await ensureLoaded()
      const settled = await Promise.allSettled(
        partNames('prompts', meta.value?.shards ?? DEFAULT_SHARDS).map((part) =>
          fetchJson<PromptDetailRaw[]>(part),
        ),
      )
      const map = new Map<number, string>()
      let succeeded = 0
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue
        succeeded += 1
        for (const entry of result.value) map.set(entry.id, entry.prompt ?? '')
      }
      // 三个分片全挂时才报错，避免一次网络抖动就静默丢失正文
      if (succeeded === 0) throw new Error('提示词正文加载失败，请检查网络后重试')
      textById.value = map
      fullLoaded.value = true
    } finally {
      fullTextLoading.value = false
    }
  }

  /** 已缓存则直接返回，否则先补齐正文 */
  async function loadDetail(id: number): Promise<PromptDetail | undefined> {
    const cached = detailCache.get(id)
    if (cached) return cached
    const summary = getById(id)
    if (!summary) return undefined
    await ensureFullText()
    const text = textById.value.get(id)
    if (text === undefined) return undefined
    const detail = toPromptDetail(summary, text)
    detailCache.set(id, detail)
    return detail
  }

  /** 卡片上直接复制时用：拿不到正文就返回空字符串 */
  async function promptTextOf(id: number): Promise<string> {
    const detail = await loadDetail(id)
    return detail?.prompt ?? ''
  }

  return {
    // 状态
    categories,
    meta,
    items,
    loading,
    fullTextLoading,
    error,
    // 派生
    loaded,
    total,
    subCategoryCount,
    majorNames,
    hotTags,
    themeOptions,
    styleOptions,
    featuredPool,
    // 方法
    paletteOf,
    subsOf,
    majorOfCategory,
    countOfMajor,
    countOfCategory,
    getById,
    ensureLoaded,
    ensureFullText,
    loadDetail,
    promptTextOf,
  }
})
