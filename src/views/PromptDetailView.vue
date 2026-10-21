<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NotFoundView from '@/views/NotFoundView.vue'
import DetailTopNav from '@/components/DetailTopNav.vue'
import ImageViewer from '@/components/ImageViewer.vue'
import PromptDetailActions from '@/components/PromptDetailActions.vue'
import { formatCount, relatedPrompts, resolvePrompt } from '@/data/library'
import { useImageFallback } from '@/composables/useImageFallback'
import { usePageMeta } from '@/composables/usePageMeta'
import { useLibraryStore } from '@/stores/library'
import type { Prompt, PromptDetail } from '@/types/prompt'

const route = useRoute()
const library = useLibraryStore()
const { onImageError } = useImageFallback()

const detail = ref<PromptDetail | null>(null)
/** 列表数据是否已就绪：在此之前不判定 404，避免先闪一下「提示词不存在」 */
const settled = ref(false)
const textError = ref('')

const promptId = computed(() => Number(route.params.id))

/** 优先用完整详情；正文没到时先用列表数据顶上，图片与标题可以立刻显示 */
const view = computed<Prompt | undefined>(
  () => detail.value ?? library.getById(promptId.value),
)

const related = computed(() => {
  const current = view.value
  if (!current || !library.loaded) return []
  return relatedPrompts(library.items, current, 4)
})

/** 主图可切换：有额外效果图时在下方展示缩略图 */
const activeImage = ref('')
const images = computed(() => {
  const current = view.value
  if (!current) return []
  const list = [current.image, ...current.gallery.filter((url) => url !== current.image)]
  return [...new Set(list.filter(Boolean))]
})

/** 主图点击 → 弹窗放大查看（滚轮缩放 / 拖拽平移），不再跳转到原图链接 */
const viewerOpen = ref(false)
const viewerSrc = ref('')

function openImageViewer(): void {
  viewerSrc.value = activeImage.value || view.value?.image || ''
  viewerOpen.value = true
}

/** 正文按 {argument…} 变量拆段，变量在渲染时单独加粗 */
const promptParts = computed(() => (detail.value?.prompt ?? '').split(/(\{[^}]*\})/))

function isPromptToken(part: string): boolean {
  return part.startsWith('{') && part.endsWith('}')
}

const metaDescription = computed(() => {
  const text = detail.value?.prompt
  if (!text) return `${view.value?.title ?? 'AI 绘图提示词'} · 复制即画 Copy2Draw`
  return resolvePrompt(text).slice(0, 150)
})

usePageMeta(() => ({
  title: view.value ? `${view.value.title}｜复制即画 Copy2Draw` : '提示词不存在｜复制即画 Copy2Draw',
  description: metaDescription.value,
}))

async function load(): Promise<void> {
  detail.value = null
  settled.value = false
  textError.value = ''
  activeImage.value = ''

  try {
    await library.ensureLoaded()
  } catch {
    // 列表加载失败时同样落到 404 分支，正文区域会给出提示
  }
  settled.value = true

  if (!library.getById(promptId.value)) return

  try {
    const loaded = await library.loadDetail(promptId.value)
    if (!loaded) {
      textError.value = '这条提示词的正文没有找到，可能数据还没同步。'
      return
    }
    detail.value = loaded
  } catch (error) {
    textError.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(load)
watch(promptId, () => {
  void load()
})
</script>

<template>
  <DetailTopNav />

  <main v-if="!settled" class="min-h-screen bg-[#fbfafc] px-5 py-8 sm:px-8 sm:py-12">
    <div class="mx-auto max-w-6xl space-y-5">
      <div class="skeleton-line w-32" />
      <div class="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div class="skeleton-card skeleton-h2" />
        <div class="space-y-3 py-6">
          <div class="skeleton-line w-2/3" />
          <div class="skeleton-line w-1/3" />
          <div class="skeleton-line w-full" />
          <div class="skeleton-line w-5/6" />
        </div>
      </div>
    </div>
  </main>

  <main v-else-if="view" class="min-h-screen bg-[#fbfafc] px-5 py-8 sm:px-8 sm:py-12">
    <div class="mx-auto max-w-6xl">
      <RouterLink
        :to="{ name: 'discover', query: { major: view.major } }"
        class="inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-violet-600"
      >
        ← 返回 {{ view.major }}
      </RouterLink>

      <article
        class="mt-5 grid overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_20px_70px_rgba(36,28,61,0.09)] lg:grid-cols-[1.05fr_0.95fr]"
      >
        <div class="flex flex-col gap-3 bg-zinc-100 p-4 sm:p-7">
          <button
            type="button"
            class="grid min-h-80 flex-1 place-items-center"
            :title="`点击放大查看「${view.title}」`"
            :aria-label="`点击放大查看${view.title}大图`"
            @click="openImageViewer"
          >
            <img
              :src="activeImage || view.image"
              :alt="view.title"
              class="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-xl shadow-zinc-300/40"
              @error="onImageError($event, view.title, view.major)"
            />
          </button>

          <div v-if="images.length > 1" class="flex flex-wrap gap-2">
            <button
              v-for="url in images"
              :key="url"
              type="button"
              class="h-16 w-16 overflow-hidden rounded-lg border-2 bg-white transition"
              :class="url === (activeImage || view.image) ? 'border-violet-500' : 'border-transparent'"
              @click="activeImage = url"
            >
              <img
                :src="url"
                :alt="`${view.title} 效果图`"
                loading="lazy"
                class="h-full w-full object-cover"
                @error="onImageError($event, view.title, view.major)"
              />
            </button>
          </div>
        </div>

        <div class="flex flex-col p-6 sm:p-9 lg:p-11">
          <nav class="text-xs font-semibold text-zinc-400">
            <RouterLink to="/" class="hover:text-violet-600">提示词库</RouterLink>
            <span class="mx-2">›</span>
            <RouterLink
              :to="{ name: 'discover', query: { major: view.major } }"
              class="hover:text-violet-600"
            >
              {{ view.major }}
            </RouterLink>
            <span class="mx-2">›</span>
            <span class="text-violet-600">{{ view.category }}</span>
          </nav>

          <h1 class="mt-5 text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
            {{ view.title }}
          </h1>

          <div class="mt-4 flex flex-wrap gap-2">
            <span class="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
              {{ view.category }}
            </span>
            <RouterLink
              v-for="tag in view.tags"
              :key="tag"
              :to="{ name: 'discover', query: { major: view.major, q: tag } }"
              class="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-violet-50 hover:text-violet-700"
            >
              #{{ tag }}
            </RouterLink>
          </div>

          <dl class="mt-7 grid grid-cols-3 border-y border-zinc-100 py-5">
            <div>
              <dt class="text-xs text-zinc-400">大类</dt>
              <dd class="mt-1 truncate text-sm font-bold text-zinc-800">{{ view.major }}</dd>
            </div>
            <div class="border-l border-zinc-100 pl-4">
              <dt class="text-xs text-zinc-400">细分类</dt>
              <dd class="mt-1 truncate text-sm font-bold text-zinc-800">{{ view.category }}</dd>
            </div>
            <div class="border-l border-zinc-100 pl-4">
              <dt class="text-xs text-zinc-400">点赞</dt>
              <dd class="mt-1 text-sm font-bold text-zinc-800">{{ formatCount(view.likes) }}</dd>
            </div>
          </dl>

          <section class="my-7">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-bold text-zinc-900">完整提示词</h2>
              <span class="text-xs text-zinc-400">
                {{ detail ? `${detail.prompt.length} 字` : '正在加载…' }}
              </span>
            </div>

            <p
              v-if="detail"
              class="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm leading-7 text-zinc-700"
            >
              <template v-for="(part, index) in promptParts" :key="index">
                <span v-if="isPromptToken(part)" class="font-semibold text-violet-700">{{ part }}</span>
                <template v-else>{{ part }}</template>
              </template>
            </p>
            <div
              v-else-if="textError"
              class="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm leading-7 text-rose-600"
            >
              {{ textError }}
              <button class="ml-2 font-bold underline" type="button" @click="load">重试</button>
            </div>
            <div v-else class="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
              <div class="skeleton-line w-3/4" />
              <div class="skeleton-line w-full" />
              <div class="skeleton-line w-5/6" />
            </div>
          </section>

          <PromptDetailActions v-if="detail" :prompt="detail" />
          <div v-else class="flex flex-wrap gap-3">
            <span class="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-400">
              正文加载中，稍后即可复制
            </span>
          </div>
        </div>
      </article>

      <section v-if="related.length" class="py-12 sm:py-16">
        <div class="mb-6 flex items-end justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Related</p>
            <h2 class="mt-2 text-2xl font-bold text-zinc-900">同类推荐</h2>
          </div>
          <RouterLink
            :to="{ name: 'discover', query: { major: view.major } }"
            class="text-sm font-semibold text-violet-600"
          >
            查看更多 →
          </RouterLink>
        </div>

        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <RouterLink
            v-for="item in related"
            :key="item.id"
            :to="{ name: 'prompt-detail', params: { id: item.id } }"
            class="group overflow-hidden rounded-2xl border border-zinc-200 bg-white text-inherit no-underline shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
          >
            <div class="aspect-[3/4] overflow-hidden bg-zinc-100">
              <img
                :src="item.image"
                :alt="item.title"
                loading="lazy"
                class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                @error="onImageError($event, item.title, item.major)"
              />
            </div>
            <div class="p-4">
              <span class="text-xs font-bold text-violet-600">{{ item.category }}</span>
              <h3 class="mt-2 truncate text-sm font-bold text-zinc-900">{{ item.title }}</h3>
            </div>
          </RouterLink>
        </div>
      </section>
    </div>
  </main>

  <NotFoundView v-else title="提示词不存在" description="这条提示词可能已被删除，或者链接有误。" />

  <ImageViewer
    v-if="viewerOpen && viewerSrc"
    :src="viewerSrc"
    :label="view?.title"
    :major="view?.major"
    @close="viewerOpen = false"
  />
</template>
