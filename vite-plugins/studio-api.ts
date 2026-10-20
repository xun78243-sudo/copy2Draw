/**
 * 开发期内容管理接口：/__studio/api/*
 *
 * 只在 `vite dev` 下挂载（apply: 'serve'），生产构建不存在这些路由。
 * 写盘范围被限制在 content/ 与 public/data/（由 scripts/lib/data-core.mjs 负责）。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Plugin, ViteDevServer } from 'vite'

type Core = typeof import('../scripts/lib/data-core.mjs')
type ListRecord = Awaited<ReturnType<Core['loadBase']>>['records'][number]

const MOUNT = '/__studio/api'

interface Snapshot {
  file: string
  content: string | null
}

interface StudioRow {
  id: number
  title: string
  category: string
  major: string
  image: string
  images: string[]
  likes: number
  person: boolean
  themes: string[]
  styles: string[]
  origin: string[]
  removed: boolean
}

export function studioApi(): Plugin {
  return {
    name: 'copy2draw-studio-api',
    apply: 'serve',
    configureServer(server) {
      const corePromise = loadCore(server)
      server.middlewares.use(MOUNT, (req, res) => {
        void handle(corePromise, req, res)
      })
    },
  }
}

function loadCore(server: ViteDevServer): Promise<Core> {
  const file = path.join(server.config.root, 'scripts', 'lib', 'data-core.mjs')
  if (!existsSync(file)) {
    return Promise.reject(new Error(`数据核心缺失：${file}`))
  }
  // 用文件 URL 动态加载，避免被 Vite 的配置打包内联（那样 import.meta.url 会指向临时目录）
  return import(/* @vite-ignore */ pathToFileURL(file).href) as Promise<Core>
}

/* --------------------------------------------------------------- HTTP 基础 */

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  if (chunks.length === 0) return null
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return null
  return JSON.parse(text) as Record<string, unknown>
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function asInt(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

/* --------------------------------------------------------------- 文件写入 */

function writeJsonFile(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function snapshotFiles(files: string[]): Snapshot[] {
  return files.map((file) => ({
    file,
    content: existsSync(file) ? readFileSync(file, 'utf8') : null,
  }))
}

function rollback(snapshots: Snapshot[]): void {
  for (const { file, content } of snapshots) {
    if (content === null) rmSync(file, { force: true })
    else writeFileSync(file, content, 'utf8')
  }
}

/* --------------------------------------------------------------- 视图组装 */

function majorOf(base: Awaited<ReturnType<Core['loadBase']>>, category: string): string {
  return base.categories[category]?.major ?? ''
}

function buildRows(core: Core): StudioRow[] {
  const base = core.loadBase()
  const content = core.loadContent()
  const removedSet = new Set(content.removed)
  const patchById = new Map(content.overrides.map(({ data }) => [data.id, data.patch]))
  const rows: StudioRow[] = []

  const push = (record: ListRecord, kind: 'baseline' | 'added'): void => {
    const patch = patchById.get(record.id)
    const effective = patch ? ({ ...record, ...patch } as ListRecord) : record
    const origin: string[] = [kind]
    if (patch) origin.push('overridden')
    const removed = removedSet.has(record.id)
    if (removed) origin.push('removed')
    rows.push({
      id: record.id,
      title: effective.title,
      category: effective.category,
      major: majorOf(base, effective.category),
      image: effective.image ?? '',
      images: Array.isArray(effective.images) ? effective.images : [],
      likes: asInt(effective.likes),
      person: Boolean(effective.person),
      themes: Array.isArray(effective.themes) ? effective.themes : [],
      styles: Array.isArray(effective.styles) ? effective.styles : [],
      origin,
      removed,
    })
  }

  for (const record of base.records) push(record, 'baseline')
  for (const { data } of content.added) push(data as unknown as ListRecord, 'added')
  return rows
}

function rankOf(row: StudioRow): number {
  if (row.removed) return 3
  if (row.origin.includes('added')) return 0
  if (row.origin.includes('overridden')) return 1
  return 2
}

/* --------------------------------------------------------------- 路由 */

async function handle(
  corePromise: Promise<Core>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let core: Core
  try {
    core = await corePromise
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    return
  }

  const url = new URL(req.url ?? '/', 'http://studio.local')
  const method = (req.method ?? 'GET').toUpperCase()
  const route = `${method} ${url.pathname.replace(/\/+$/, '') || '/'}`

  try {
    switch (route) {
      case 'GET /state':
        return sendJson(res, 200, stateOf(core))
      case 'GET /items':
        return sendJson(res, 200, itemsOf(core, url))
      case 'GET /item': {
        const payload = itemOf(core, url)
        return payload
          ? sendJson(res, 200, payload)
          : sendJson(res, 404, { error: '条目不存在' })
      }
      case 'POST /items':
        return sendCreate(core, req, res)
      case 'PATCH /item':
        return sendPatch(core, req, res)
      case 'POST /revert': {
        const body = (await readJsonBody(req)) ?? {}
        const id = asInt(body.id, -1)
        const content = core.loadContent()
        const existing = content.overrides.find(({ data }) => data.id === id)
        if (!existing) return sendJson(res, 404, { error: `没有找到 id ${id} 的修改记录` })
        const snapshot = snapshotFiles([existing.file])
        rmSync(existing.file, { force: true })
        const validation = core.validate({ base: core.loadBase(), content: core.loadContent() })
        if (validation.errors.length > 0) {
          rollback(snapshot)
          return sendJson(res, 400, { errors: validation.errors })
        }
        return sendJson(res, 200, { ok: true, reverted: id })
      }
      case 'DELETE /item':
        return sendDelete(core, url, res)
      case 'POST /rebuild':
        return sendJson(res, 200, core.rebuild())
      case 'GET /check':
        return sendJson(res, 200, core.checkCurrent())
      case 'POST /check-images': {
        const body = await readJsonBody(req)
        const ids = Array.isArray(body?.ids) ? body.ids : []
        const result = await core.checkImages(ids as number[])
        return sendJson(res, 200, result)
      }
      case 'POST /restore': {
        const body = await readJsonBody(req)
        const name = asString(body?.name)
        if (!name) return sendJson(res, 400, { error: '缺少备份名称' })
        core.restoreBackup(name)
        return sendJson(res, 200, { ok: true, backups: core.listBackups(), check: core.checkCurrent() })
      }
      default:
        return sendJson(res, 404, { error: `未知接口：${route}` })
    }
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

function stateOf(core: Core): Record<string, unknown> {
  const base = core.loadBase()
  const content = core.loadContent()
  const validation = core.validate({ base, content })
  const current = core.checkCurrent()
  return {
    total: current.stats?.total ?? base.records.length,
    baseline: base.records.length,
    added: content.added.length,
    removed: content.removed.length,
    overridden: content.overrides.length,
    shards: current.stats?.shards ?? base.shards,
    synced: validation.errors.length === 0 && current.ok,
    errors: validation.errors,
    warnings: validation.warnings,
    stale: current.stale,
    backups: core.listBackups(),
    imageBase: process.env.VITE_IMAGE_BASE || 'https://r2.qqsrc.com',
    majors: base.meta.majors.map((major) => ({
      name: major.name,
      count: major.count,
      subs: major.subs.map((sub) => sub.name),
    })),
    categories: base.categories,
    removedIds: content.removed,
    addedIds: content.added.map(({ data }) => data.id),
    overrideIds: content.overrides.map(({ data }) => data.id),
  }
}

function itemsOf(core: Core, url: URL): Record<string, unknown> {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const origin = url.searchParams.get('origin') ?? 'all'
  const major = url.searchParams.get('major') ?? ''
  const category = url.searchParams.get('category') ?? ''
  const limit = Math.min(Math.max(asInt(url.searchParams.get('limit'), 24), 1), 200)
  const offset = Math.max(asInt(url.searchParams.get('offset')), 0)

  const rows = buildRows(core).sort((a, b) => rankOf(a) - rankOf(b) || b.id - a.id)
  const filtered = rows.filter((row) => {
    if (origin === 'added' && !row.origin.includes('added')) return false
    if (origin === 'overridden' && !row.origin.includes('overridden')) return false
    if (origin === 'removed' && !row.removed) return false
    if (origin === 'baseline' && row.origin.includes('added')) return false
    if (major && row.major !== major) return false
    if (category && row.category !== category) return false
    if (query) {
      const haystack = `${row.id} ${row.title} ${row.category} ${row.major}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })

  return {
    total: filtered.length,
    offset,
    limit,
    items: filtered.slice(offset, offset + limit),
  }
}

function itemOf(core: Core, url: URL): Record<string, unknown> | null {
  const id = asInt(url.searchParams.get('id'), -1)
  const base = core.loadBase()
  const content = core.loadContent()
  const added = content.added.find(({ data }) => data.id === id)
  const record = added?.data ?? base.records.find((entry) => entry.id === id)
  if (!record) return null
  const patch = content.overrides.find(({ data }) => data.id === id)?.data.patch
  const effective = patch ? ({ ...record, ...patch } as ListRecord & { prompt?: string }) : record
  const text = patch && typeof patch.prompt === 'string'
    ? patch.prompt
    : added
      ? added.data.prompt
      : (base.texts.get(id)?.prompt ?? '')
  return {
    id,
    title: effective.title,
    category: effective.category,
    major: majorOf(base, effective.category),
    image: effective.image ?? '',
    images: Array.isArray(effective.images) ? effective.images : [],
    likes: asInt(effective.likes),
    person: Boolean(effective.person),
    themes: Array.isArray(effective.themes) ? effective.themes : [],
    styles: Array.isArray(effective.styles) ? effective.styles : [],
    prompt: text,
    origin: [added ? 'added' : 'baseline', ...(patch ? ['overridden'] : []), ...(content.removed.includes(id) ? ['removed'] : [])],
    removed: content.removed.includes(id),
    file: added ? path.relative(core.PATHS.root, added.file) : null,
  }
}

async function sendCreate(core: Core, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) ?? {}
  const content = core.loadContent()
  const nextId = content.added.reduce((max, { data }) => Math.max(max, data.id), core.ADDED_ID_START - 1) + 1
  const entry = {
    id: nextId,
    title: asString(body.title),
    category: asString(body.category),
    ...(asString(body.major) ? { major: asString(body.major) } : {}),
    image: asString(body.image),
    images: asStringArray(body.images),
    likes: asInt(body.likes),
    person: body.person === true,
    themes: asStringArray(body.themes),
    styles: asStringArray(body.styles),
    prompt: asString(body.prompt),
  }
  const file = path.join(core.PATHS.added, `${nextId}.json`)
  writeJsonFile(file, entry)

  const validation = core.validate({ base: core.loadBase(), content: core.loadContent() })
  if (validation.errors.length > 0) {
    rmSync(file, { force: true })
    return sendJson(res, 400, { errors: validation.errors })
  }
  return sendJson(res, 200, { id: nextId, file: path.relative(core.PATHS.root, file), warnings: validation.warnings })
}

async function sendPatch(core: Core, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await readJsonBody(req)) ?? {}
  const id = asInt(body.id, -1)
  const patch = (body.patch ?? {}) as Record<string, unknown>
  if (id < 0) return sendJson(res, 400, { error: '缺少 id' })

  const base = core.loadBase()
  const content = core.loadContent()
  const added = content.added.find(({ data }) => data.id === id)

  if (added) {
    const snapshot = snapshotFiles([added.file])
    writeJsonFile(added.file, { ...added.data, ...patch })
    const validation = core.validate({ base, content: core.loadContent() })
    if (validation.errors.length > 0) {
      rollback(snapshot)
      return sendJson(res, 400, { errors: validation.errors })
    }
    return sendJson(res, 200, { ok: true, target: 'added', warnings: validation.warnings })
  }

  if (!base.records.some((entry) => entry.id === id)) {
    return sendJson(res, 404, { error: `条目不存在：${id}` })
  }

  const existing = content.overrides.find(({ data }) => data.id === id)
  const file = existing?.file ?? path.join(core.PATHS.overrides, `${id}.json`)
  const snapshot = snapshotFiles([file])
  const mergedPatch = { ...(existing?.data.patch ?? {}), ...patch }
  writeJsonFile(file, { id, patch: mergedPatch })

  const validation = core.validate({ base, content: core.loadContent() })
  if (validation.errors.length > 0) {
    rollback(snapshot)
    return sendJson(res, 400, { errors: validation.errors })
  }
  return sendJson(res, 200, { ok: true, target: 'override', warnings: validation.warnings })
}

async function sendDelete(core: Core, url: URL, res: ServerResponse): Promise<void> {
  const id = asInt(url.searchParams.get('id'), -1)
  const restore = url.searchParams.get('restore') === '1'
  if (id < 0) return sendJson(res, 400, { error: '缺少 id' })

  const base = core.loadBase()
  const content = core.loadContent()
  const added = content.added.find(({ data }) => data.id === id)
  const inBase = base.records.some((entry) => entry.id === id)
  if (!added && !inBase) return sendJson(res, 404, { error: `条目不存在：${id}` })

  // 新增条目：下架=删文件，恢复=回到文件（删掉时无法恢复，这里只处理下架）
  if (added && !restore) {
    const snapshot = snapshotFiles([added.file])
    rmSync(added.file, { force: true })
    const validation = core.validate({ base, content: core.loadContent() })
    if (validation.errors.length > 0) {
      rollback(snapshot)
      return sendJson(res, 400, { errors: validation.errors })
    }
    return sendJson(res, 200, { ok: true, removed: true, target: 'added' })
  }

  const ids = new Set(content.removed)
  if (restore) ids.delete(id)
  else ids.add(id)

  const snapshot = snapshotFiles([core.PATHS.removed])
  writeJsonFile(core.PATHS.removed, { ids: [...ids].sort((a, b) => a - b) })
  const validation = core.validate({ base, content: core.loadContent() })
  if (validation.errors.length > 0) {
    rollback(snapshot)
    return sendJson(res, 400, { errors: validation.errors })
  }
  return sendJson(res, 200, { ok: true, removed: !restore })
}
