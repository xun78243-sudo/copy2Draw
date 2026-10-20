/**
 * `data-core.mjs` 的类型声明，供 TypeScript（vite-plugins/studio-api.ts）使用。
 * 实现保持纯 JS，脚本与中间件共用同一份逻辑。
 */

export interface SubCategory {
  name: string
  count: number
}

export interface MajorCategory {
  name: string
  count: number
  subs: SubCategory[]
  main: string
  bg: string
}

export interface LibraryMeta {
  total: number
  subCount: number
  hot: string[]
  majors: MajorCategory[]
  colors: Record<string, { main: string; bg: string }>
  shards?: number
}

export interface ListRecord {
  id: number
  title: string
  category: string
  image: string
  images: string[]
  likes: number
  tweet: string | null
  themes: string[]
  styles: string[]
  person: boolean
}

export interface PromptRecord extends ListRecord {
  thumb: string
  prompt: string
}

export type Patch = Partial<Pick<ListRecord, 'title' | 'category' | 'image' | 'images' | 'likes' | 'person' | 'themes' | 'styles'>> & {
  prompt?: string
}

export interface AddedEntry extends Partial<ListRecord> {
  id: number
  title: string
  category: string
  image: string
  prompt: string
  major?: string
  thumb?: string
}

export interface ContentData {
  added: { file: string; name: string; data: AddedEntry }[]
  overrides: { file: string; name: string; data: { id: number; patch: Patch } }[]
  removed: number[]
}

export interface BaseData {
  meta: LibraryMeta
  categories: Record<string, { count: number; major: string }>
  records: ListRecord[]
  texts: Map<number, { prompt: string; thumb: string }>
  promptRecords: Map<number, PromptRecord>
  shards: number
}

export interface Stats {
  total: number
  baseline: number
  added: number
  removed: number
  overridden: number
  shards?: number
  files?: number
}

export interface Model {
  list: ListRecord[]
  texts: Map<number, { prompt: string; thumb: string }>
  promptRecords: Map<number, PromptRecord>
  patches: Map<number, Patch>
  categories: Map<string, { count: number; major: string }>
  meta: LibraryMeta & { shards: number }
  shards: number
  stats: Stats
}

export interface Validation {
  errors: string[]
  warnings: string[]
}

export interface RebuildResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  stats: Stats | null
  backup: string | null
}

export interface ImageCheckResult {
  id: number
  title: string
  path: string
  url: string
  ok: boolean
  status: number
  error?: string
}

export interface Paths {
  root: string
  base: string
  content: string
  added: string
  overrides: string
  removed: string
  backup: string
  output: string
}

export const PATHS: Paths
export const ADDED_ID_START: number
export const SHARD_MIN: number
export const SHARD_SIZE: number
export const HOT_SIZE: number
export const PATCH_FIELDS: string[]

export function isImagePath(value: unknown): boolean
export function toImageUrl(imagePath: string | null | undefined): string
export function loadBase(): BaseData
export function loadContent(): ContentData
export function validate(input: { base: BaseData; content: ContentData }): Validation
export function buildModel(input: { base: BaseData; content: ContentData }): Model
export function serializeModel(model: Model): Map<string, string>
export function backupOutput(reason?: string): string | null
export function listBackups(): { name: string; files: number }[]
export function restoreBackup(name: string): { restored: string }
export function rebuild(options?: { backup?: boolean }): RebuildResult
export function checkCurrent(): {
  ok: boolean
  errors: string[]
  warnings: string[]
  stale: { file: string; reason: string }[]
  stats: Stats | null
}
export function checkImages(
  ids: (number | string)[],
  options?: { concurrency?: number; timeout?: number },
): Promise<{ checked: number; failed: ImageCheckResult[]; results: ImageCheckResult[] }>
