<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useVisitorStats } from '@/composables/useVisitorStats'

const { stats, ready, countVisit } = useVisitorStats()

onMounted(() => {
  void countVisit()
})

function format(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US')
}

const rows = computed(() => [
  { label: '今日访问', value: format(stats.today) },
  { label: '总访问量', value: format(stats.total) },
  { label: '总访客数', value: format(stats.visitors) },
])
</script>

<template>
  <aside class="visit-card" aria-label="站点访问统计">
    <p class="visit-card-title">
      <span class="visit-card-dot" :class="{ 'is-live': ready }" />
      站点访问
    </p>
    <dl class="visit-card-rows" aria-live="polite">
      <div v-for="row in rows" :key="row.label" class="visit-card-row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
  </aside>
</template>
