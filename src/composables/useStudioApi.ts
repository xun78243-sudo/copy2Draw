/**
 * `/__studio/api` 的轻量客户端。
 * 失败时抛出 Error（消息优先取服务端的 error / errors）。
 */
import type {
  StudioImageReport,
  StudioItemDetail,
  StudioListResponse,
  StudioRebuildResult,
  StudioSavePayload,
  StudioState,
} from '@/types/studio'

const API_BASE = '/__studio/api'

interface ErrorPayload {
  error?: string
  errors?: string[]
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const data = payload as ErrorPayload | null
    const details = data?.errors ?? []
    throw new Error(data?.error ?? details[0] ?? `请求失败（HTTP ${response.status}）`)
  }

  return payload as T
}

export interface StudioListQuery {
  q?: string
  origin?: string
  major?: string
  category?: string
  offset?: number
  limit?: number
}

export const studioApi = {
  state: () => request<StudioState>('/state'),

  items: (query: StudioListQuery = {}) => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.origin && query.origin !== 'all') params.set('origin', query.origin)
    if (query.major) params.set('major', query.major)
    if (query.category) params.set('category', query.category)
    params.set('offset', String(query.offset ?? 0))
    params.set('limit', String(query.limit ?? 24))
    return request<StudioListResponse>(`/items?${params.toString()}`)
  },

  item: (id: number) => request<StudioItemDetail>(`/item?id=${id}`),

  create: (payload: StudioSavePayload) =>
    request<{ id: number; file: string; warnings: string[] }>('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: number, patch: Partial<StudioSavePayload>) =>
    request<{ ok: boolean; target: string; warnings: string[] }>('/item', {
      method: 'PATCH',
      body: JSON.stringify({ id, patch }),
    }),

  remove: (id: number) =>
    request<{ ok: boolean; removed: boolean }>(`/item?id=${id}`, { method: 'DELETE' }),

  restore: (id: number) =>
    request<{ ok: boolean; removed: boolean }>(`/item?id=${id}&restore=1`, { method: 'DELETE' }),

  revert: (id: number) =>
    request<{ ok: boolean; reverted: number }>('/revert', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),

  rebuild: () => request<StudioRebuildResult>('/rebuild', { method: 'POST' }),

  checkImages: (ids: number[]) =>
    request<StudioImageReport>('/check-images', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  restoreBackup: (name: string) =>
    request<{ ok: boolean; backups: StudioState['backups'] }>('/restore', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
}
