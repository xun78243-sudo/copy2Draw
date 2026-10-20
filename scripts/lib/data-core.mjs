/**
 * 数据核心：基线 + 覆盖层 → public/data 的唯一实现。
 *
 * 同时被两处使用：
 *   - scripts/build-data.mjs / scripts/check-data.mjs（命令行）
 *   - vite-plugins/studio-api.ts（开发期本地写盘接口，动态 import 本模块）
 *
 * 只用 Node 内置模块，不引入依赖。
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 项目根目录 */
export const ROOT = path.resolve(HERE, '..', '..')

export const PATHS = {
  root: ROOT,
  /** 上游基线（只读，不参与部署） */
  base: path.join(ROOT, 'data', 'base'),
  content: path.join(ROOT, 'content'),
  added: path.join(ROOT, 'content', 'added'),
  overrides: path.join(ROOT, 'content', 'overrides'),
  removed: path.join(ROOT, 'content', 'removed.json'),
  backup: path.join(ROOT, 'content', '.backup'),
  /** 生成产物（前端 fetch 的目录） */
  output: path.join(ROOT, 'public', 'data'),
}

/** 新增条目的 id 起点：避开上游稀疏 id 段（13443–35448） */
export const ADDED_ID_START = 100001
/** 最少分片数，保持与现有前端一致的 3 片 */
export const SHARD_MIN = 3
/** 单片刻度：超过则增加分片（5,430 条 → 3 片，与上游分片方式一致） */
export const SHARD_SIZE = 2000
/** meta.hot 的长度 */
export const HOT_SIZE = 10
/** 可通过覆盖层修改的字段 */
export const PATCH_FIELDS = [
  'title',
  'category',
  'image',
  'images',
  'likes',
  'person',
  'themes',
  'styles',
  'prompt',
]

const FALLBACK_COLOR = { main: '#9a93a8', bg: '#e7e3ec' }

/** 相对路径的图片基址，与 src/data/library.ts 的默认值保持一致 */
const IMAGE_BASE = (process.env.VITE_IMAGE_BASE || 'https://r2.qqsrc.com').replace(/\/+$/, '')

/* ------------------------------------------------------------------ 基础工具 */

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/')
}

function readJson(file) {
  const raw = readFileSync(file, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`${rel(file)} 不是合法 JSON：${error.message}`)
  }
}

function readJsonDir(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((name) => {
      const file = path.join(dir, name)
      return { file, name, data: readJson(file) }
    })
}

function writeFileAtomic(file, content) {
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, content, 'utf8')
  try {
    renameSync(tmp, file)
  } catch {
    rmSync(file, { force: true })
    renameSync(tmp, file)
  }
}

/** 图片字段：允许 http(s) 绝对地址，或图床相对路径 */
export function isImagePath(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  if (/^https?:\/\//i.test(text)) return true
  if (text.includes('..')) return false
  if (text.startsWith('/') || text.startsWith('\\')) return false
  if (/^[a-zA-Z]:/.test(text)) return false
  return !/\s/.test(text)
}

export function toImageUrl(imagePath) {
  if (!imagePath) return ''
  return /^https?:\/\//i.test(imagePath) ? imagePath : `${IMAGE_BASE}/${imagePath.replace(/^\/+/, '')}`
}

/* ------------------------------------------------------------------ 读取 */

/** 读取上游基线：meta + 分类 + 分片列表 + 正文 */
export function loadBase() {
  const listFiles = readdirSync(PATHS.base)
    .filter((name) => /^list\.part\d+\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const promptFiles = readdirSync(PATHS.base)
    .filter((name) => /^prompts\.part\d+\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  if (listFiles.length === 0) {
    throw new Error(`基线数据缺失：${rel(PATHS.base)} 下没有 list.partN.json`)
  }

  const meta = readJson(path.join(PATHS.base, 'meta.json'))
  const categories = readJson(path.join(PATHS.base, 'categories.json'))

  const records = []
  for (const name of listFiles) records.push(...readJson(path.join(PATHS.base, name)))

  /** id → 正文；正文分片可缺失（不阻断，详情页会提示） */
  const texts = new Map()
  /** id → 基线正文记录（保留其原始字段，重建时逐字节不变） */
  const promptRecords = new Map()
  for (const name of promptFiles) {
    for (const entry of readJson(path.join(PATHS.base, name))) {
      texts.set(entry.id, { prompt: entry.prompt ?? '', thumb: entry.thumb ?? '' })
      promptRecords.set(entry.id, entry)
    }
  }

  return { meta, categories, records, texts, promptRecords, shards: listFiles.length }
}

/** 读取覆盖层：新增 / 覆盖 / 下架 */
export function loadContent() {
  const added = readJsonDir(PATHS.added)
  const overrides = readJsonDir(PATHS.overrides)
  let removed = []
  if (existsSync(PATHS.removed)) {
    const raw = readJson(PATHS.removed)
    removed = Array.isArray(raw) ? raw : (raw.ids ?? [])
  }
  return { added, overrides, removed }
}

/* ------------------------------------------------------------------ 校验 */

function checkString(errors, where, field, value, { max = 200, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${where}: 缺少字段 ${field}`)
    return
  }
  if (typeof value !== 'string') {
    errors.push(`${where}: ${field} 必须是字符串`)
    return
  }
  const text = value.trim()
  if (required && !text) errors.push(`${where}: ${field} 不能为空`)
  if (text.length > max) errors.push(`${where}: ${field} 超过 ${max} 字`)
}

function checkStringArray(errors, where, field, value) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    errors.push(`${where}: ${field} 必须是字符串数组`)
    return
  }
  if (value.length > 20) errors.push(`${where}: ${field} 最多 20 项`)
  value.forEach((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      errors.push(`${where}: ${field}[${index}] 必须是非空字符串`)
    }
  })
}

function checkImageList(errors, where, field, value) {
  if (value === undefined) return
  if (!Array.isArray(value)) {
    errors.push(`${where}: ${field} 必须是数组`)
    return
  }
  if (value.length > 12) errors.push(`${where}: ${field} 最多 12 张`)
  value.forEach((item, index) => {
    if (!isImagePath(item)) {
      errors.push(`${where}: ${field}[${index}] 不是合法图片路径（${String(item)}）`)
    }
  })
}

/**
 * 校验基线 + 覆盖层。
 * 返回 { errors, warnings }；errors 非空时禁止写盘。
 */
export function validate({ base, content }) {
  const errors = []
  const warnings = []

  // 基线自身完整性
  const baseIds = new Set()
  for (const record of base.records) {
    if (!Number.isInteger(record?.id)) {
      errors.push(`data/base: 存在 id 非法的记录`)
      continue
    }
    if (baseIds.has(record.id)) errors.push(`data/base: id ${record.id} 重复`)
    baseIds.add(record.id)
  }
  if (base.meta?.total !== base.records.length) {
    warnings.push(
      `data/base/meta.json 的 total（${base.meta?.total}）与列表条数（${base.records.length}）不一致，重建后将以实际条数为准`,
    )
  }

  const baseCategories = base.categories ?? {}
  const majorNames = new Set((base.meta?.majors ?? []).map((major) => major.name))
  const addedById = new Map()
  const addedMajorByCategory = new Map()

  // 新增条目
  for (const { file, data } of content.added) {
    const where = rel(file)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push(`${where}: 内容必须是对象`)
      continue
    }
    if (!Number.isInteger(data.id)) {
      errors.push(`${where}: id 必须是整数`)
    } else if (data.id < ADDED_ID_START) {
      errors.push(`${where}: 新增条目 id 必须 ≥ ${ADDED_ID_START}（避免与上游冲突）`)
    } else if (baseIds.has(data.id)) {
      errors.push(`${where}: id ${data.id} 与基线记录重复`)
    } else if (addedById.has(data.id)) {
      errors.push(`${where}: id ${data.id} 与其他新增条目重复`)
    }
    if (Number.isInteger(data.id)) addedById.set(data.id, data)

    checkString(errors, where, 'title', data.title, { max: 120 })
    checkString(errors, where, 'category', data.category, { max: 40 })
    checkString(errors, where, 'prompt', data.prompt, { max: 20000 })
    checkString(errors, where, 'image', data.image, { max: 300 })
    if (data.image !== undefined && !isImagePath(data.image)) {
      errors.push(`${where}: image 不是合法图片路径（${String(data.image)}）`)
    }
    if (data.thumb !== undefined && !isImagePath(data.thumb)) {
      errors.push(`${where}: thumb 不是合法图片路径（${String(data.thumb)}）`)
    }
    checkImageList(errors, where, 'images', data.images)
    checkStringArray(errors, where, 'themes', data.themes)
    checkStringArray(errors, where, 'styles', data.styles)

    if (data.likes !== undefined && (!Number.isInteger(data.likes) || data.likes < 0)) {
      errors.push(`${where}: likes 必须是非负整数`)
    }
    if (data.person !== undefined && typeof data.person !== 'boolean') {
      errors.push(`${where}: person 必须是布尔值`)
    }

    // 分类：已存在则沿用基线的大类；新分类必须显式声明 major
    const category = typeof data.category === 'string' ? data.category.trim() : ''
    if (category) {
      if (baseCategories[category]) {
        if (data.major && data.major !== baseCategories[category].major) {
          warnings.push(
            `${where}: 分类「${category}」已存在，其大类为「${baseCategories[category].major}」，已忽略填写的大类「${data.major}」`,
          )
        }
      } else {
        if (!data.major) {
          errors.push(`${where}: 新分类「${category}」必须填写 major（所属大类）`)
        } else if (!majorNames.has(data.major)) {
          errors.push(`${where}: major「${data.major}」不在 meta.json 的 12 大类中`)
        } else {
          addedMajorByCategory.set(category, data.major)
        }
      }
    }
  }

  // 覆盖
  const overrideIds = new Set()
  for (const { file, data } of content.overrides) {
    const where = rel(file)
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push(`${where}: 内容必须是对象`)
      continue
    }
    if (!Number.isInteger(data.id)) {
      errors.push(`${where}: id 必须是整数`)
      continue
    }
    if (!baseIds.has(data.id) && !addedById.has(data.id)) {
      errors.push(`${where}: id ${data.id} 在基线与新增中都不存在`)
    }
    if (overrideIds.has(data.id)) errors.push(`${where}: id ${data.id} 被重复覆盖`)
    overrideIds.add(data.id)

    const patch = data.patch
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      errors.push(`${where}: patch 必须是对象`)
      continue
    }
    for (const key of Object.keys(patch)) {
      if (!PATCH_FIELDS.includes(key)) {
        errors.push(`${where}: patch 含不支持的字段「${key}」（可用：${PATCH_FIELDS.join('、')}）`)
      }
    }
    if ('title' in patch) checkString(errors, where, 'patch.title', patch.title, { max: 120 })
    if ('category' in patch) {
      checkString(errors, where, 'patch.category', patch.category, { max: 40 })
      const category = typeof patch.category === 'string' ? patch.category.trim() : ''
      if (category && !baseCategories[category] && !addedMajorByCategory.has(category)) {
        errors.push(`${where}: 覆盖后的分类「${category}」不存在，请先在 data/base/categories.json 或新增条目里创建`)
      }
    }
    if ('image' in patch && !isImagePath(patch.image)) {
      errors.push(`${where}: patch.image 不是合法图片路径（${String(patch.image)}）`)
    }
    if ('images' in patch) checkImageList(errors, where, 'patch.images', patch.images)
    if ('themes' in patch) checkStringArray(errors, where, 'patch.themes', patch.themes)
    if ('styles' in patch) checkStringArray(errors, where, 'patch.styles', patch.styles)
    if ('prompt' in patch) checkString(errors, where, 'patch.prompt', patch.prompt, { max: 20000 })
    if ('likes' in patch && (!Number.isInteger(patch.likes) || patch.likes < 0)) {
      errors.push(`${where}: patch.likes 必须是非负整数`)
    }
    if ('person' in patch && typeof patch.person !== 'boolean') {
      errors.push(`${where}: patch.person 必须是布尔值`)
    }
  }

  // 下架
  const removedIds = new Set()
  for (const id of content.removed) {
    if (!Number.isInteger(id)) {
      errors.push(`content/removed.json: id 必须是整数（${String(id)}）`)
      continue
    }
    if (!baseIds.has(id) && !addedById.has(id)) {
      errors.push(`content/removed.json: id ${id} 在基线与新增中都不存在`)
    }
    if (removedIds.has(id)) errors.push(`content/removed.json: id ${id} 重复`)
    removedIds.add(id)
    // 已下架的条目允许保留 overrides：下架优先，恢复后修改仍在
  }

  return { errors, warnings }
}

/* ------------------------------------------------------------------ 合并 */

function toListRecord(record) {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    image: record.image,
    images: Array.isArray(record.images) ? [...record.images] : [],
    likes: Number.isInteger(record.likes) ? record.likes : 0,
    tweet: record.tweet ?? null,
    themes: Array.isArray(record.themes) ? [...record.themes] : [],
    styles: Array.isArray(record.styles) ? [...record.styles] : [],
    person: Boolean(record.person),
  }
}

/**
 * 正文记录：基线原样保留字段顺序与取值（重建逐字节不变），
 * 覆盖层只改指定字段，新增条目按基线字段顺序构造。
 */
function toPromptRecord(item, model) {
  const text = model.texts.get(item.id) ?? { prompt: '', thumb: '' }
  const raw = model.promptRecords.get(item.id)
  if (raw) {
    const record = { ...raw }
    const patch = model.patches.get(item.id)
    if (patch) {
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'prompt') continue
        record[key] = value
      }
    }
    record.prompt = text.prompt
    record.thumb = text.thumb
    return record
  }
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    image: item.image,
    thumb: text.thumb,
    images: item.images,
    likes: item.likes,
    tweet: item.tweet,
    themes: item.themes,
    styles: item.styles,
    person: item.person,
    prompt: text.prompt,
  }
}

function topFacets(list, size) {
  const counts = new Map()
  for (const item of list) {
    for (const value of [...(item.themes ?? []), ...(item.styles ?? [])]) {
      if (!value) continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
    .slice(0, size)
    .map((entry) => entry.label)
}

/** 合并基线 + 覆盖层，得到最终列表、分类计数与 meta */
export function buildModel({ base, content }) {
  const removedSet = new Set(content.removed)
  const overrideById = new Map(content.overrides.map(({ data }) => [data.id, data.patch ?? {}]))
  const addedById = new Map(content.added.map(({ data }) => [data.id, data]))
  const addedMajorByCategory = new Map()
  for (const { data } of content.added) {
    const category = typeof data.category === 'string' ? data.category.trim() : ''
    if (category && data.major && !base.categories[category]) addedMajorByCategory.set(category, data.major)
  }

  const list = []
  for (const record of base.records) {
    if (removedSet.has(record.id)) continue
    const patch = overrideById.get(record.id)
    list.push(toListRecord(patch ? { ...record, ...patch } : record))
  }
  // 新增条目按 id 追加在末尾：基线顺序原样保留，重建不会打乱既有分片
  const addedRecords = []
  for (const [id, entry] of addedById) {
    if (removedSet.has(id)) continue
    const patch = overrideById.get(id)
    addedRecords.push(toListRecord(patch ? { ...entry, ...patch } : entry))
  }
  addedRecords.sort((a, b) => a.id - b.id)
  list.push(...addedRecords)

  // 分类计数（细分类 → 数量 / 所属大类）
  const categories = new Map()
  for (const [name, entry] of Object.entries(base.categories ?? {})) {
    categories.set(name, { count: 0, major: entry.major })
  }
  for (const item of list) {
    let entry = categories.get(item.category)
    if (!entry) {
      entry = { count: 0, major: addedMajorByCategory.get(item.category) ?? '' }
      categories.set(item.category, entry)
    }
    entry.count += 1
  }

  // meta：重算总量、大类/细分类计数、热门词；保留配色
  const majors = (base.meta?.majors ?? []).map((major) => {
    const subs = major.subs.map((sub) => ({ name: sub.name, count: categories.get(sub.name)?.count ?? 0 }))
    const known = new Set(subs.map((sub) => sub.name))
    for (const [name, entry] of categories) {
      if (entry.major === major.name && !known.has(name)) {
        subs.push({ name, count: entry.count })
        known.add(name)
      }
    }
    return {
      name: major.name,
      count: subs.reduce((sum, sub) => sum + sub.count, 0),
      subs,
      main: major.main,
      bg: major.bg,
    }
  })

  const colors = { ...(base.meta?.colors ?? {}) }
  const firstMajorColor = majors.length ? { main: majors[0].main, bg: majors[0].bg } : FALLBACK_COLOR
  for (const [name, entry] of categories) {
    if (!colors[name]) colors[name] = colors[entry.major] ?? firstMajorColor
  }

  const shards = Math.max(SHARD_MIN, Math.ceil(list.length / SHARD_SIZE))
  // 热门标签沿用上游人工整理的结果；基线没有时才按主题/风格热度重算
  const hot = base.meta?.hot?.length ? [...base.meta.hot] : topFacets(list, HOT_SIZE)
  const meta = {
    total: list.length,
    subCount: categories.size,
    hot,
    majors,
    colors,
    shards,
  }

  // 正文：基线的按 id 取，覆盖层可改写，新增自带
  const texts = new Map()
  for (const [id, text] of base.texts) texts.set(id, { prompt: text.prompt, thumb: text.thumb })
  for (const [id, patch] of overrideById) {
    if (!('prompt' in patch)) continue
    const current = texts.get(id) ?? { prompt: '', thumb: '' }
    texts.set(id, { ...current, prompt: patch.prompt })
  }
  for (const [id, entry] of addedById) {
    const patch = overrideById.get(id) ?? {}
    texts.set(id, {
      prompt: patch.prompt ?? entry.prompt ?? '',
      thumb: patch.image ? patch.image : (entry.thumb ?? entry.image ?? ''),
    })
  }

  const stats = {
    total: list.length,
    baseline: base.records.length,
    added: content.added.length,
    removed: content.removed.length,
    overridden: content.overrides.length,
  }

  return {
    list,
    texts,
    promptRecords: base.promptRecords,
    patches: overrideById,
    categories,
    meta,
    shards,
    stats,
  }
}

/** 按固定顺序切分片：list/prompts 使用同一切分，保证两份文件对齐 */
function chunkEven(list, shards) {
  const size = Math.max(1, Math.ceil(list.length / shards))
  const chunks = []
  for (let index = 0; index < shards; index += 1) {
    chunks.push(list.slice(index * size, (index + 1) * size))
  }
  return chunks
}

/** 模型 → 待写入的 { 文件名: 序列化内容 }，字段顺序与上游保持一致 */
export function serializeModel(model) {
  const files = new Map()

  const categoryObject = {}
  for (const [name, entry] of model.categories) {
    categoryObject[name] = { count: entry.count, major: entry.major }
  }
  files.set('categories.json', JSON.stringify(categoryObject))
  files.set('meta.json', JSON.stringify(model.meta))

  chunkEven(model.list, model.shards).forEach((chunk, index) => {
    const n = index + 1
    files.set(`list.part${n}.json`, JSON.stringify(chunk))
    files.set(
      `prompts.part${n}.json`,
      JSON.stringify(chunk.map((item) => toPromptRecord(item, model))),
    )
  })

  return files
}

/* ------------------------------------------------------------------ 备份 */

/** 备份当前产物，返回相对路径 */
export function backupOutput(reason = 'rebuild') {
  if (!existsSync(PATHS.output)) return null
  const files = readdirSync(PATHS.output).filter((name) => name.endsWith('.json'))
  if (files.length === 0) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const target = path.join(PATHS.backup, `${stamp}-${reason}`)
  mkdirSync(target, { recursive: true })
  for (const name of files) cpSync(path.join(PATHS.output, name), path.join(target, name))
  pruneBackups(10)
  return rel(target)
}

function listBackupDirs() {
  if (!existsSync(PATHS.backup)) return []
  return readdirSync(PATHS.backup, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
}

function pruneBackups(keep) {
  for (const name of listBackupDirs().slice(keep)) {
    rmSync(path.join(PATHS.backup, name), { recursive: true, force: true })
  }
}

/** 可用备份列表（新的在前） */
export function listBackups() {
  return listBackupDirs().map((name) => ({
    name,
    files: readdirSync(path.join(PATHS.backup, name)).filter((file) => file.endsWith('.json')).length,
  }))
}

/** 用指定备份覆盖 public/data（覆盖前会先备份当前状态） */
export function restoreBackup(name) {
  const from = path.join(PATHS.backup, name)
  if (!existsSync(from)) throw new Error(`备份不存在：${name}`)
  backupOutput('before-restore')
  for (const file of readdirSync(from)) {
    cpSync(path.join(from, file), path.join(PATHS.output, file))
  }
  return { restored: rel(from) }
}

/* ------------------------------------------------------------------ 重建 / 检查 */

/** 校验 + 合并 + 备份 + 原子写；errors 非空时不写盘 */
export function rebuild({ backup = true } = {}) {
  let base
  let content
  try {
    base = loadBase()
    content = loadContent()
  } catch (error) {
    return { ok: false, errors: [error.message], warnings: [], stats: null, backup: null }
  }

  const { errors, warnings } = validate({ base, content })
  if (errors.length > 0) {
    return { ok: false, errors, warnings, stats: null, backup: null }
  }

  const model = buildModel({ base, content })
  const files = serializeModel(model)
  const backupDir = backup ? backupOutput('rebuild') : null

  for (const [name, payload] of files) {
    writeFileAtomic(path.join(PATHS.output, name), payload)
  }
  // 分片变少时清掉多余文件
  for (const name of readdirSync(PATHS.output)) {
    if (/^(list|prompts)\.part\d+\.json$/.test(name) && !files.has(name)) {
      rmSync(path.join(PATHS.output, name), { force: true })
    }
  }

  return {
    ok: true,
    errors: [],
    warnings,
    stats: { ...model.stats, shards: model.shards, files: files.size },
    backup: backupDir,
  }
}

/** 对比「按 content 重建会得到的结果」与磁盘现状，发现未重建的改动 */
export function checkCurrent() {
  let base
  let content
  try {
    base = loadBase()
    content = loadContent()
  } catch (error) {
    return { ok: false, errors: [error.message], warnings: [], stale: [], stats: null }
  }

  const { errors, warnings } = validate({ base, content })
  if (errors.length > 0) {
    return { ok: false, errors, warnings, stale: [], stats: null }
  }

  const model = buildModel({ base, content })
  const files = serializeModel(model)

  const stale = []
  for (const [name, payload] of files) {
    const file = path.join(PATHS.output, name)
    if (!existsSync(file)) {
      stale.push({ file: name, reason: '缺失' })
      continue
    }
    const current = readFileSync(file, 'utf8')
    if (current !== payload) stale.push({ file: name, reason: '与 content/ 不一致' })
  }
  if (existsSync(PATHS.output)) {
    for (const name of readdirSync(PATHS.output)) {
      if (/^(list|prompts)\.part\d+\.json$/.test(name) && !files.has(name)) {
        stale.push({ file: name, reason: '多余分片' })
      }
    }
  }

  return {
    ok: stale.length === 0,
    errors: [],
    warnings,
    stale,
    stats: { ...model.stats, shards: model.shards },
  }
}

/**
 * 抽查图片可达性（HEAD 请求）。
 * 只检查指定 id，避免一次打 5,430 个请求。
 */
export async function checkImages(ids, { concurrency = 8, timeout = 8000 } = {}) {
  const base = loadBase()
  const content = loadContent()
  const model = buildModel({ base, content })
  const byId = new Map(model.list.map((item) => [item.id, item]))
  const targets = []
  for (const id of ids) {
    const item = byId.get(Number(id))
    if (!item) continue
    targets.push({ id: item.id, title: item.title, path: item.image, url: toImageUrl(item.image) })
    for (const extra of item.images ?? []) {
      targets.push({ id: item.id, title: item.title, path: extra, url: toImageUrl(extra) })
    }
  }
  const results = []
  let cursor = 0
  const worker = async () => {
    while (cursor < targets.length) {
      const current = targets[cursor]
      cursor += 1
      try {
        const response = await fetch(current.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(timeout),
        })
        results.push({ ...current, ok: response.ok, status: response.status })
      } catch (error) {
        results.push({ ...current, ok: false, status: 0, error: String(error?.message ?? error) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length || 1) }, worker))
  results.sort((a, b) => a.id - b.id)
  return { checked: results.length, failed: results.filter((item) => !item.ok), results }
}
