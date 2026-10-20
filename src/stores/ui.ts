import { ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * 全局界面状态。
 * 移动端抽屉需要被「外壳」和「发现页悬浮搜索」同时感知，因此放进 store，
 * 替代原型 PromptLibrary 组件里层层传递的 mobileNav 状态。
 */
export const useUiStore = defineStore('ui', () => {
  const mobileNavOpen = ref(false)

  function openMobileNav(): void {
    mobileNavOpen.value = true
  }

  function closeMobileNav(): void {
    mobileNavOpen.value = false
  }

  function toggleMobileNav(): void {
    mobileNavOpen.value = !mobileNavOpen.value
  }

  return { mobileNavOpen, openMobileNav, closeMobileNav, toggleMobileNav }
})
