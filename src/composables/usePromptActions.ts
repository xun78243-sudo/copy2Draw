import { computed, onBeforeUnmount, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { Prompt } from '@/types/prompt'
import { resolvePrompt } from '@/data/library'
import { useFavoritesStore } from '@/stores/favorites'
import { useLibraryStore } from '@/stores/library'
import { useToastStore } from '@/stores/toast'
import { copyText } from './useClipboard'
import { downloadImage } from './useDownloadImage'

const COPIED_FEEDBACK_MS = 1800

/**
 * 卡片与详情页共用的提示词操作：复制、收藏、下载。
 *
 * 正文是分层加载的：列表里只有标题和图片，第一次点复制时才去拉取
 * `prompts.part*.json` 并缓存，所以复制与下载都是异步的。
 */
export function usePromptActions(promptSource: MaybeRefOrGetter<Prompt>) {
  const prompt = computed(() => toValue(promptSource))
  const favorites = useFavoritesStore()
  const library = useLibraryStore()
  const toast = useToastStore()

  const copied = ref(false)
  /** 正在拉取正文，用于禁用按钮、避免重复点击 */
  const busy = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const isFavorite = computed(() => favorites.has(prompt.value.id))

  /** 露出「已复制」态，1.8 秒后恢复 */
  function markCopied(): void {
    copied.value = true
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
      timer = undefined
    }, COPIED_FEEDBACK_MS)
  }

  /** 复制成品：变量用默认值补齐，粘出去就能直接用 */
  async function copy(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      const text = await library.promptTextOf(prompt.value.id)
      if (!text) {
        toast.show('提示词正文加载失败，请稍后重试')
        return
      }
      await copyText(resolvePrompt(text))
      markCopied()
      toast.show('提示词已复制到剪贴板')
    } catch {
      toast.show('提示词正文加载失败，请稍后重试')
    } finally {
      busy.value = false
    }
  }

  function toggleFavorite(): void {
    favorites.toggle(prompt.value.id)
  }

  async function download(): Promise<void> {
    await downloadImage(prompt.value.image, `${prompt.value.title}-${prompt.value.id}`)
  }

  onBeforeUnmount(() => {
    if (timer !== undefined) clearTimeout(timer)
  })

  return { copied, busy, isFavorite, markCopied, copy, toggleFavorite, download }
}
