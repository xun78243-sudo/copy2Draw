import { computed, reactive, ref } from 'vue'

/**
 * 站点访问统计（Vercount 公共计数服务，零注册）。
 *
 * 官方 js 的做法是往 https://events.vercount.one/api/v2/log POST
 * `{ url, isNewUv }`，返回 `{ site_pv, site_uv, page_pv }`：
 * - site_pv：站点总访问量（每次访问 +1）
 * - site_uv：站点总访客数（靠 1 年期 cookie 去重）
 * - page_pv：被统计 URL 的访问量
 *
 * 该服务没有「按天」的字段，所以这里把上报 URL 换成 `{origin}/__stats/{YYYY-MM-DD}`
 * 这样的按天分桶路径：站点 PV 仍然是一次访问记一次，而 page_pv 恰好变成
 * 「今日访问」的计数桶。换服务时只需要改这一个文件。
 */
const ENDPOINT = 'https://events.vercount.one/api/v2/log'
const CACHE_KEY = 'copy2draw.visitor.stats'
const REQUEST_TIMEOUT = 6000
const UV_COOKIE_MAX_AGE = 31536000000
/**
 * 本地 / 内网地址的计数桶。
 * Vercount 按 host 归户，但 localhost、127.0.0.1 这类地址会被归到它自己的
 * 公共兜底桶（能返回上千万的全站汇总），既不准也会把开发流量混进去。
 * 这里改用 RFC 2606 保留的 .invalid 域名单独开一个「本项目演示桶」，
 * 本地预览能拿到真实自增的数字，线上则走自己的真实域名。
 */
const DEMO_ORIGIN = 'https://copy2draw.invalid'

export interface VisitorStats {
  /** 今日访问（按天分桶的访问数） */
  today: number | null
  /** 站点总访问量 */
  total: number | null
  /** 站点总访客数 */
  visitors: number | null
}

interface CacheEntry {
  day: string
  today: number | null
  total: number
  visitors: number
}

const stats = reactive<VisitorStats>({ today: null, total: null, visitors: null })
const loading = ref(false)
const failed = ref(false)
let counted = false

/** 本地时区的 YYYY-MM-DD（sv-SE 的日期格式刚好一致） */
function localDay(): string {
  return new Date().toLocaleDateString('sv-SE')
}

/** 本地、内网、file:// 等没法归户的地址 */
function isLocalHost(host: string): boolean {
  const name = host.split(':')[0].toLowerCase().replace(/^\[|\]$/g, '')
  if (!name) return true
  if (name === 'localhost' || name === '0.0.0.0' || name === '::1') return true
  if (/^127\./.test(name) || /^10\./.test(name) || /^192\.168\./.test(name)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(name)) return true
  return name.endsWith('.local') || name.endsWith('.internal')
}

/** 上报用的站点前缀：真实域名用自己，其余用演示桶 */
function statOrigin(): string {
  const { protocol, host } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return DEMO_ORIGIN
  return isLocalHost(host) ? DEMO_ORIGIN : window.location.origin
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CacheEntry>
    if (typeof parsed.total !== 'number' || typeof parsed.visitors !== 'number') return null
    return {
      day: String(parsed.day ?? ''),
      today: typeof parsed.today === 'number' ? parsed.today : null,
      total: parsed.total,
      visitors: parsed.visitors,
    }
  } catch {
    return null
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // 隐私模式写不进去，忽略即可
  }
}

/** 与官方 js 一致的 UV cookie：首次访问标记为“新访客” */
function isNewVisitor(cookieName: string): boolean {
  if (document.cookie.split('; ').some((part) => part.startsWith(`${cookieName}=`))) return false
  const expires = new Date(Date.now() + UV_COOKIE_MAX_AGE).toUTCString()
  document.cookie = `${cookieName}=1; path=/; expires=${expires}; samesite=lax`
  return true
}

async function countVisit(): Promise<void> {
  const day = localDay()
  const cached = readCache()
  if (cached) {
    stats.total = cached.total
    stats.visitors = cached.visitors
    stats.today = cached.day === day ? cached.today : null
  }

  // 一次页面加载只计一次；SPA 内部跳转不会重复计数
  if (counted) return
  counted = true
  loading.value = true
  failed.value = false

  const host = window.location.host || 'unknown-host'
  const url = `${statOrigin()}/__stats/${day}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        isNewUv: isNewVisitor(`vercount_uv_${host.replace(/[^a-zA-Z0-9_-]/g, '_')}`),
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as {
      data?: { site_pv?: number; site_uv?: number; page_pv?: number }
    }
    const data = payload.data
    if (!data) throw new Error('unexpected payload')
    stats.today = Number(data.page_pv ?? 0)
    stats.total = Number(data.site_pv ?? 0)
    stats.visitors = Number(data.site_uv ?? 0)
    writeCache({ day, today: stats.today, total: stats.total, visitors: stats.visitors })
  } catch {
    // 计数失败不阻塞页面：沿用缓存值，没有缓存就显示 “—”
    failed.value = true
  } finally {
    window.clearTimeout(timer)
    loading.value = false
  }
}

export function useVisitorStats() {
  const ready = computed(() => stats.total !== null)
  return { stats, loading, failed, ready, countVisit }
}
