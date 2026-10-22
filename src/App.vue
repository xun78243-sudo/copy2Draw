<script setup lang="ts">
import { onMounted } from 'vue'
import AppToast from '@/components/base/AppToast.vue'
import { useVisitorStats } from '@/composables/useVisitorStats'

// 站点访问计数：每次页面加载记一次，SPA 内跳转不重复计数
const { countVisit } = useVisitorStats()
onMounted(() => {
  void countVisit()
})
</script>

<template>
  <div id="root" tabindex="-1">
    <RouterView />
  </div>
  <AppToast />
</template>
