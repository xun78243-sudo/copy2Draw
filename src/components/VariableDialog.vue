<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PromptVariable } from '@/types/prompt'
import { copyText } from '@/composables/useClipboard'
import { resolvePrompt } from '@/data/library'

const props = defineProps<{
  /** 是否显示弹窗 */
  open: boolean
  /** 原始提示词模板（保留 {argument …} 占位） */
  prompt: string
  /** 从模板解析出的变量 */
  variables: PromptVariable[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  /** 复制成品后通知父级刷新「已复制」态 */
  copied: []
}>()

const values = ref<Record<string, string>>({})
const templateCopied = ref(false)
const bodyEl = ref<HTMLElement | null>(null)

let templateTimer: ReturnType<typeof setTimeout> | undefined
let savedOverflow: string | null = null

/** 把占位替换成用户输入；留空回退默认值，得到可直接使用的成品 */
const resolvedPrompt = computed(() => resolvePrompt(props.prompt, values.value))

/** 还有哪些变量没填，用于页脚提示 */
const emptyCount = computed(
  () => props.variables.filter((variable) => !values.value[variable.name]?.trim()).length,
)

function close(): void {
  emit('update:open', false)
}

function lockScroll(): void {
  if (savedOverflow !== null) return
  savedOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockScroll(): void {
  if (savedOverflow === null) return
  document.body.style.overflow = savedOverflow
  savedOverflow = null
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lockScroll()
      window.addEventListener('keydown', handleKeydown)
      await nextTick()
      // 打开后聚焦第一个变量输入框
      bodyEl.value?.querySelector('input')?.focus()
      return
    }
    unlockScroll()
    window.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

// 换一条提示词时清空上一轮输入，避免把 A 的取值带到 B
watch(
  () => props.prompt,
  () => {
    values.value = {}
  },
)

onBeforeUnmount(() => {
  unlockScroll()
  window.removeEventListener('keydown', handleKeydown)
  if (templateTimer !== undefined) clearTimeout(templateTimer)
})

async function copyResolved(): Promise<void> {
  await copyText(resolvedPrompt.value)
  close()
  emit('copied')
}

async function copyTemplate(): Promise<void> {
  await copyText(props.prompt)
  templateCopied.value = true
  if (templateTimer !== undefined) clearTimeout(templateTimer)
  templateTimer = setTimeout(() => {
    templateCopied.value = false
    templateTimer = undefined
  }, 1500)
}

function resetValues(): void {
  values.value = {}
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[150] grid place-items-center bg-zinc-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      @mousedown.self="close"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="variable-dialog-title"
        class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
      >
        <header class="flex items-start justify-between border-b border-zinc-100 px-6 py-5 sm:px-7">
          <div>
            <h2 id="variable-dialog-title" class="text-xl font-bold tracking-tight text-zinc-900">
              填好变量，一次复制成品
            </h2>
            <p class="mt-1.5 text-sm text-zinc-500">
              共 {{ variables.length }} 个变量，替换后预览无误即可复制使用。
            </p>
          </div>
          <button
            type="button"
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-lg text-zinc-500 transition hover:bg-zinc-100"
            aria-label="关闭变量弹窗"
            @click="close"
          >
            ×
          </button>
        </header>

        <div ref="bodyEl" class="overflow-y-auto px-6 py-5 sm:px-7 sm:py-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <label v-for="variable in variables" :key="variable.name" class="block">
              <span class="flex items-center justify-between gap-3 text-sm font-bold text-zinc-800">
                <span class="truncate">{{ variable.name }}</span>
                <span class="truncate text-xs font-normal text-zinc-400">
                  默认：{{ variable.defaultValue || '（空）' }}
                </span>
              </span>
              <input
                v-model="values[variable.name]"
                :placeholder="variable.placeholder"
                class="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
            </label>
          </div>

          <div class="mt-6 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:p-5">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">成品预览</span>
              <span class="text-xs text-zinc-400">留空时使用默认值</span>
            </div>
            <p
              class="max-h-52 overflow-auto whitespace-pre-wrap text-sm leading-7 text-zinc-700"
              data-testid="variable-preview"
            >
              {{ resolvedPrompt }}
            </p>
          </div>
        </div>

        <footer class="flex flex-wrap items-center gap-3 border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 sm:px-7">
          <button
            type="button"
            class="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
            @click="copyResolved"
          >
            复制成品
          </button>
          <button
            type="button"
            class="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-violet-300"
            @click="copyTemplate"
          >
            {{ templateCopied ? '模板已复制' : '复制原始模板' }}
          </button>
          <span class="ml-auto text-xs text-zinc-400">
            {{ emptyCount ? `${emptyCount} 项将使用默认值` : '全部已填写' }}
          </span>
          <button
            type="button"
            class="px-2 py-3 text-sm font-semibold text-zinc-500 transition hover:text-violet-600"
            @click="resetValues"
          >
            恢复默认
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
