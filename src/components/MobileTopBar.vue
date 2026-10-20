<script setup lang="ts">
import AppIcon from './base/AppIcon.vue'
import AppLogo from './base/AppLogo.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <header class="mobile-bar">
    <button class="icon-btn menu-btn" type="button" aria-label="打开菜单" @click="ui.openMobileNav()">
      <AppIcon name="menu" />
    </button>
    <div class="mobile-logo"><AppLogo /></div>
  </header>
</template>
