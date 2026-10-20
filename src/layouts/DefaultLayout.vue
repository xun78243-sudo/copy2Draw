<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import MobileTopBar from '@/components/MobileTopBar.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const route = useRoute()

// 路由切换后自动收起移动端抽屉，避免遮挡新页面
watch(
  () => route.fullPath,
  () => ui.closeMobileNav(),
)
</script>

<template>
  <div class="app-shell">
    <AppSidebar />

    <button
      v-if="ui.mobileNavOpen"
      class="nav-backdrop"
      type="button"
      aria-label="关闭导航"
      @click="ui.closeMobileNav()"
    />

    <main class="main">
      <MobileTopBar />
      <RouterView />
    </main>
  </div>
</template>
