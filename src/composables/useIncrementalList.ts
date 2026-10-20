import { computed, ref, watch, type ComputedRef } from 'vue'
import { PAGE_SIZE } from '@/data/library'
import type { Prompt } from '@/types/prompt'

/**
 * 增量渲染：5430 条数据不可能一次挂到 DOM 上，
 * 这里只渲染前 N 条，滚动到底或点「加载更多」时再追加一批。
 * 筛选结果变化时自动回到第一页。
 */
export function useIncrementalList(source: ComputedRef<readonly Prompt[]>, step = PAGE_SIZE) {
  const visibleCount = ref(step)

  watch(source, () => {
    visibleCount.value = step
  })

  const visible = computed(() => source.value.slice(0, visibleCount.value))
  const remaining = computed(() => Math.max(source.value.length - visibleCount.value, 0))
  const hasMore = computed(() => remaining.value > 0)

  function loadMore(): void {
    if (!hasMore.value) return
    visibleCount.value = Math.min(visibleCount.value + step, source.value.length)
  }

  return { visible, remaining, hasMore, loadMore }
}
