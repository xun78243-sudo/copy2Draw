<script setup lang="ts">
export interface FilterTab {
  label: string
  value: string
  count?: number
}

defineProps<{ tabs: FilterTab[]; active: string }>()

const emit = defineEmits<{ select: [value: string] }>()
</script>

<template>
  <div class="filter-tabs" role="tablist" aria-label="按大类筛选">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      class="filter-tab"
      :class="{ 'is-active': active === tab.value }"
      type="button"
      role="tab"
      :aria-selected="active === tab.value"
      @click="emit('select', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
