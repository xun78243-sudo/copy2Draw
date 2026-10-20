<script setup lang="ts">
import AppToast from '@/components/base/AppToast.vue'
</script>

<template>
  <div id="root" tabindex="-1">
    <RouterView />
  </div>
  <AppToast />
</template>
