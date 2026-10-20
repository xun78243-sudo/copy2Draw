/**
 * `/studio` 内容管理页面与 `/__studio/api` 的数据契约。
 * 接口只在开发期存在，见 vite-plugins/studio-api.ts。
 */

export interface StudioRow {
  id: number
  title: string
  category: string
  major: string
  /** 图床相对路径 */
  image: string
  images: string[]
  likes: number
  person: boolean
  themes: string[]
  styles: string[]
  /** 来源标记：baseline / added / overridden / removed（可组合） */
  origin: string[]
  removed: boolean
}

export interface StudioItemDetail extends StudioRow {
  prompt: string
  /** 新增条目所在文件（基线条目为 null） */
  file: string | null
}

export interface StudioMajorOption {
  name: string
  count: number
  subs: string[]
}

export interface StudioBackup {
  name: string
  files: number
}

export interface StudioStaleFile {
  file: string
  reason: string
}

export interface StudioState {
  total: number
  baseline: number
  added: number
  removed: number
  overridden: number
  shards: number
  synced: boolean
  errors: string[]
  warnings: string[]
  stale: StudioStaleFile[]
  backups: StudioBackup[]
  imageBase: string
  majors: StudioMajorOption[]
  categories: Record<string, { count: number; major: string }>
  removedIds: number[]
  addedIds: number[]
  overrideIds: number[]
}

export interface StudioListResponse {
  total: number
  offset: number
  limit: number
  items: StudioRow[]
}

export interface StudioStats {
  total: number
  baseline: number
  added: number
  removed: number
  overridden: number
  shards?: number
  files?: number
}

export interface StudioRebuildResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  stats: StudioStats | null
  backup: string | null
}

export interface StudioImageCheck {
  id: number
  title: string
  path: string
  url: string
  ok: boolean
  status: number
  error?: string
}

export interface StudioImageReport {
  checked: number
  failed: StudioImageCheck[]
  results: StudioImageCheck[]
}

export interface StudioSavePayload {
  title: string
  category: string
  major?: string
  image: string
  images: string[]
  likes: number
  person: boolean
  themes: string[]
  styles: string[]
  prompt: string
}
