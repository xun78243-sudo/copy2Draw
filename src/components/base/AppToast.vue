<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div v-if="toast.message" class="toast" role="status" aria-live="polite">
    <span><AppIcon name="check" :size="15" /></span>{{ toast.message }}
  </div>
</template>
