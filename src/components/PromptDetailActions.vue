<script setup lang="ts">
import { computed, ref } from 'vue'
import VariableDialog from './VariableDialog.vue'
import { usePromptActions } from '@/composables/usePromptActions'
import { useToastStore } from '@/stores/toast'
import type { PromptDetail } from '@/types/prompt'

const props = defineProps<{ prompt: PromptDetail }>()

const toast = useToastStore()
const dialogOpen = ref(false)
const { copied, busy, isFavorite, markCopied, copy, toggleFavorite, download } = usePromptActions(
  () => props.prompt,
)

/** 只有模板里存在 {argument …} 时才提供「填变量并复制」 */
const hasVariables = computed(() => props.prompt.variables.length > 0)

/** 弹窗里复制成品后，详情页按钮同样显示「已复制提示词」 */
function onDialogCopied(): void {
  markCopied()
  toast.show('成品提示词已复制到剪贴板')
}
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <button
      v-if="hasVariables"
      type="button"
      class="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700"
      @click="dialogOpen = true"
    >
      填变量并复制（{{ prompt.variables.length }}）
    </button>
    <button
      type="button"
      class="rounded-xl px-5 py-3 text-sm font-bold transition"
      :class="
        hasVariables
          ? 'border border-zinc-200 bg-white text-zinc-700 hover:border-violet-300'
          : 'bg-violet-600 text-white shadow-lg shadow-violet-200 hover:bg-violet-700'
      "
      :disabled="busy"
      @click="copy"
    >
      {{ busy ? '正在加载正文…' : copied ? '已复制提示词' : '直接复制' }}
    </button>
    <button
      type="button"
      class="rounded-xl border px-5 py-3 text-sm font-semibold transition"
      :class="
        isFavorite
          ? 'border-rose-200 bg-rose-50 text-rose-600'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-violet-300'
      "
      @click="toggleFavorite"
    >
      {{ isFavorite ? '已收藏' : '收藏' }}
    </button>
    <button
      type="button"
      class="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-300"
      @click="download"
    >
      下载图片
    </button>
  </div>

  <VariableDialog
    v-model:open="dialogOpen"
    :prompt="prompt.prompt"
    :variables="prompt.variables"
    @copied="onDialogCopied"
  />
</template>
