import type {
  Prompt,
  PromptDetail,
  PromptFilters,
  PromptRecordRaw,
  PromptVariable,
} from '@/types/prompt'

/**
 * 数据层纯函数：图片地址、字段映射、变量解析、筛选排序。
 * 只做转换，不发请求 —— 请求逻辑在 `stores/library.ts`。
 */

/** 默认图床地址，可用 `VITE_IMAGE_BASE` 覆盖（换 R2 域名或自建图床） */
export const IMAGE_BASE = (import.meta.env.VITE_IMAGE_BASE || 'https://r2.qqsrc.com').replace(
  /\/+$/,
  '',
)

/** 数据目录（跟随 Vite 的 BASE_URL，便于部署到子路径） */
export const DATA_BASE = `${import.meta.env.BASE_URL}data`

/** 「全部」筛选值，与 URL 查询参数配合使用 */
export const ALL_LABEL = '全部'

/** 单次增量加载的卡片数量 */
export const PAGE_SIZE = 24

/** 图床相对路径 → 完整地址；已是 http(s) 时原样返回 */
export function imageUrl(path: string | null | undefined): string {
  if (!path) return ''
  return /^https?:\/\//i.test(path) ? path : `${IMAGE_BASE}/${path.replace(/^\/+/, '')}`
}

/** 点赞数等计数的展示文案：1.2k / 23.4k */
export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0'
  if (value < 1000) return String(value)
  const thousands = value / 1000
  return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, '')}k`
}

/** 大数字（提示词总量）的千分位展示 */
export function formatTotal(value: number): string {
  return value.toLocaleString('en-US')
}

/** 把原始条目映射为列表视图模型；majorOf 负责细分类 → 大类 */
export function toPrompt(
  raw: PromptRecordRaw,
  majorOf: (category: string) => string,
): Prompt {
  const themes = raw.themes ?? []
  const styles = raw.styles ?? []
  return {
    id: raw.id,
    title: raw.title,
    category: raw.category,
    major: majorOf(raw.category),
    themes,
    styles,
    tags: [...themes, ...styles],
    likes: raw.likes ?? 0,
    imagePath: raw.image,
    image: imageUrl(raw.image),
    gallery: (raw.images ?? []).map(imageUrl).filter(Boolean),
    person: Boolean(raw.person),
  }
}

/** 图片加载失败时的占位图：分类配色渐变 + 首字 */
export function fallbackImage(label: string, main = '#9a93a8', bg = '#e7e3ec'): string {
  const char = escapeXml((label || '图').trim().slice(0, 1) || '图')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${main}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="500" fill="url(#g)"/>` +
    `<text x="200" y="285" text-anchor="middle" font-family="'Noto Sans SC',system-ui,sans-serif" ` +
    `font-size="118" font-weight="700" fill="#ffffff" fill-opacity="0.88">${char}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 单次替换用的占位正则；每次新建，避免 lastIndex 在多次调用间残留 */
function argumentPattern(): RegExp {
  return /\{argument\s+name="([^"]+)"(?:\s+default="([^"]*)")?\s*\}/g
}

/**
 * 解析正文里的 `{argument name="角色" default="Albedo"}` 占位。
 * 与上游 features.js 的 parseVars 行为一致：同名变量只取第一次出现的默认值。
 */
export function parseVariables(text: string): PromptVariable[] {
  if (!text) return []
  const found = new Map<string, string>()
  const pattern = argumentPattern()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1].trim()
    if (!found.has(name)) found.set(name, match[2] ?? '')
  }
  return [...found.entries()].map(([name, defaultValue]) => ({
    name,
    defaultValue,
    placeholder: defaultValue ? `例如：${truncate(defaultValue, 24)}` : `填写${name}`,
  }))
}

/**
 * 把变量占位替换成用户输入，得到「能直接用的成品」。
 * 留空时回退默认值；默认值也为空时整段占位被移除。
 */
export function resolvePrompt(text: string, values: Record<string, string> = {}): string {
  if (!text) return ''
  return text.replace(argumentPattern(), (_all, name: string, fallback?: string) => {
    const typed = values[name]?.trim()
    if (typed) return typed
    return fallback ?? ''
  })
}

/** 详情模型：列表项 + 正文 + 变量，构造结果可放心缓存 */
export function toPromptDetail(prompt: Prompt, text: string): PromptDetail {
  return { ...prompt, prompt: text, variables: parseVariables(text) }
}

/** 标题、细分类、大类、主题、风格任一命中关键词（大小写不敏感） */
export function matchesQuery(item: Prompt, needle: string): boolean {
  if (!needle) return true
  return (
    item.title.toLowerCase().includes(needle) ||
    item.category.toLowerCase().includes(needle) ||
    item.major.toLowerCase().includes(needle) ||
    item.themes.some((theme) => theme.toLowerCase().includes(needle)) ||
    item.styles.some((style) => style.toLowerCase().includes(needle))
  )
}

/** 按筛选条件过滤；`ALL_LABEL` 等价于「不限制」 */
export function filterPrompts(list: readonly Prompt[], filters: PromptFilters): Prompt[] {
  const needle = (filters.query ?? '').trim().toLowerCase()
  const major = filters.major && filters.major !== ALL_LABEL ? filters.major : ''
  const category = filters.category && filters.category !== ALL_LABEL ? filters.category : ''
  return list.filter(
    (item) =>
      (!major || item.major === major) &&
      (!category || item.category === category) &&
      (!filters.theme || item.themes.includes(filters.theme)) &&
      (!filters.style || item.styles.includes(filters.style)) &&
      matchesQuery(item, needle),
  )
}

/** 同细分类优先、同大类兜底的推荐内容，按点赞降序，排除自身 */
export function relatedPrompts(list: readonly Prompt[], prompt: Prompt, limit = 4): Prompt[] {
  const sameCategory: Prompt[] = []
  const sameMajor: Prompt[] = []
  for (const item of list) {
    if (item.id === prompt.id) continue
    if (item.category === prompt.category) sameCategory.push(item)
    else if (item.major === prompt.major) sameMajor.push(item)
  }
  const byLikes = (a: Prompt, b: Prompt) => b.likes - a.likes
  return [...sameCategory.sort(byLikes), ...sameMajor.sort(byLikes)].slice(0, limit)
}

/** 分面计数：主题 / 风格的出现次数，按数量降序 */
export function countFacet(
  list: readonly Prompt[],
  key: 'themes' | 'styles',
): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of list) {
    for (const value of item[key]) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}
