<script setup lang="ts">
import AppIcon from './AppIcon.vue'
</script>

<template>
  <RouterLink class="brand" to="/" aria-label="复制即画 Copy2Draw 首页">
    <span class="brand-mark"><AppIcon name="sparkles" :size="17" /></span>
    <span>复制即画 <small>Copy2Draw</small></span>
  </RouterLink>
</template>
