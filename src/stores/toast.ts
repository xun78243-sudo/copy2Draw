import { ref } from 'vue'
import { defineStore } from 'pinia'

/** 全局轻提示：复制成功等一次性反馈 */
export const useToastStore = defineStore('toast', () => {
  const message = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function show(text: string, duration = 1800): void {
    message.value = text
    clearTimer()
    timer = setTimeout(() => {
      message.value = null
      timer = undefined
    }, duration)
  }

  function hide(): void {
    clearTimer()
    message.value = null
  }

  return { message, show, hide }
})
