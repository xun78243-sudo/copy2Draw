import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'copy2draw:favorites'

function readStoredIds(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
  } catch {
    return []
  }
}

/**
 * 收藏夹：原型里用组件内 `Set` 保存，刷新即丢失。
 * 这里改为 Pinia 单例并持久化到 localStorage，跨路由、跨会话保持一致。
 */
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref<number[]>(readStoredIds())

  const count = computed(() => ids.value.length)

  function has(id: number): boolean {
    return ids.value.includes(id)
  }

  function toggle(id: number): void {
    ids.value = has(id) ? ids.value.filter((item) => item !== id) : [...ids.value, id]
  }

  function clear(): void {
    ids.value = []
  }

  watch(
    ids,
    (value) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // 隐私模式下写入失败不影响本次会话
      }
    },
    { deep: true },
  )

  return { ids, count, has, toggle, clear }
})
