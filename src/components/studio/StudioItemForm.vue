<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { imageUrl } from '@/data/library'
import type { StudioItemDetail, StudioMajorOption, StudioSavePayload } from '@/types/studio'

const props = defineProps<{
  open: boolean
  item: StudioItemDetail | null
  categories: Record<string, { count: number; major: string }>
  majors: StudioMajorOption[]
  busy: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [payload: StudioSavePayload]
}>()

const form = reactive({
  title: '',
  category: '',
  major: '',
  image: '',
  imagesText: '',
  likes: 0,
  person: false,
  themesText: '',
  stylesText: '',
  prompt: '',
})

const localError = ref('')
const previewBroken = ref(false)

const categoryOptions = computed(() => Object.keys(props.categories).sort((a, b) => a.localeCompare(b, 'zh-CN')))
const categoryName = computed(() => form.category.trim())
const isNewCategory = computed(() => categoryName.value !== '' && !(categoryName.value in props.categories))
const mappedMajor = computed(() => props.categories[categoryName.value]?.major ?? '')
const previewSrc = computed(() => (form.image.trim() ? imageUrl(form.image.trim()) : ''))

const canSubmit = computed(
  () =>
    !props.busy &&
    form.title.trim() !== '' &&
    categoryName.value !== '' &&
    form.image.trim() !== '' &&
    form.prompt.trim() !== '' &&
    (!isNewCategory.value || form.major !== ''),
)

function splitList(text: string): string[] {
  return text
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const item = props.item
    form.title = item?.title ?? ''
    form.category = item?.category ?? ''
    form.major = item?.major ?? props.majors[0]?.name ?? ''
    form.image = item?.image ?? ''
    form.imagesText = (item?.images ?? []).join('\n')
    form.likes = item?.likes ?? 0
    form.person = item?.person ?? false
    form.themesText = (item?.themes ?? []).join('，')
    form.stylesText = (item?.styles ?? []).join('，')
    form.prompt = item?.prompt ?? ''
    localError.value = ''
    previewBroken.value = false
  },
)

watch(
  () => form.image,
  () => {
    previewBroken.value = false
  },
)

function submit(): void {
  localError.value = ''
  if (!form.title.trim()) {
    localError.value = '请填写标题'
    return
  }
  if (!categoryName.value) {
    localError.value = '请填写分类'
    return
  }
  if (isNewCategory.value && !form.major) {
    localError.value = '新分类需要选择所属大类'
    return
  }
  if (!form.image.trim()) {
    localError.value = '请填写图片路径（图床相对路径或完整 https 地址）'
    return
  }
  if (!form.prompt.trim()) {
    localError.value = '请填写提示词正文'
    return
  }

  emit('save', {
    title: form.title.trim(),
    category: categoryName.value,
    ...(isNewCategory.value ? { major: form.major } : {}),
    image: form.image.trim(),
    images: splitList(form.imagesText),
    likes: Math.max(0, Math.trunc(Number(form.likes) || 0)),
    person: form.person,
    themes: splitList(form.themesText),
    styles: splitList(form.stylesText),
    prompt: form.prompt,
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/45 p-4 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-form-title"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        <header class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="studio-form-title" class="text-lg font-semibold text-zinc-950">
              {{ item ? '编辑提示词' : '新建提示词' }}
            </h2>
            <p class="mt-1 text-sm text-zinc-500">
              <template v-if="item">#{{ item.id }} · {{ item.origin.includes('added') ? '新增条目' : '基线条目（保存后写入覆盖层）' }}</template>
              <template v-else>保存后还需点「重建数据」才会出现在站点上</template>
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="关闭"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          </button>
        </header>

        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
          <label class="md:col-span-2 flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">标题</span>
            <input v-model="form.title" type="text" maxlength="120" class="studio-input" placeholder="例如：雾中茶室" />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">分类（细分类）</span>
            <input
              v-model="form.category"
              type="text"
              maxlength="40"
              list="studio-category-options"
              class="studio-input"
              placeholder="选择已有分类，或直接输入新分类"
            />
            <datalist id="studio-category-options">
              <option v-for="name in categoryOptions" :key="name" :value="name" />
            </datalist>
            <span class="text-xs text-zinc-500">
              <template v-if="mappedMajor">所属大类：{{ mappedMajor }}</template>
              <template v-else-if="isNewCategory">新分类，需要在右侧选择所属大类</template>
              <template v-else>填写后会显示所属大类</template>
            </span>
          </label>

          <label v-if="isNewCategory" class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">所属大类</span>
            <select v-model="form.major" class="studio-input">
              <option v-for="major in majors" :key="major.name" :value="major.name">{{ major.name }}</option>
            </select>
          </label>
          <div v-else class="flex flex-col justify-end gap-1.5 pb-1">
            <span class="text-xs text-zinc-500">已有分类的大类由数据决定，无需选择。</span>
          </div>

          <label class="md:col-span-2 flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">主图路径</span>
            <input
              v-model="form.image"
              type="text"
              maxlength="300"
              class="studio-input"
              placeholder="images/originals/14347.jpg 或 https://cdn.example.com/a.jpg"
            />
            <span class="text-xs text-zinc-500">相对路径会拼上图床域名；图片需要你自己先传到 R2。</span>
          </label>

          <div v-if="previewSrc" class="md:col-span-2">
            <div class="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3">
              <img
                v-if="!previewBroken"
                :src="previewSrc"
                alt=""
                class="h-24 w-24 flex-none rounded-xl object-cover ring-1 ring-zinc-200"
                @error="previewBroken = true"
              />
              <div v-else class="flex h-24 w-24 flex-none items-center justify-center rounded-xl bg-zinc-200 text-xs text-zinc-500">
                图片加载失败
              </div>
              <div class="min-w-0 text-xs text-zinc-500">
                <p class="truncate font-mono">{{ previewSrc }}</p>
                <p class="mt-1">地址可达性可点顶部「图片体检」批量检查。</p>
              </div>
            </div>
          </div>

          <label class="md:col-span-2 flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">图集（每行一个，可留空）</span>
            <textarea v-model="form.imagesText" rows="2" class="studio-input font-mono text-xs" placeholder="images/originals/14347-2.jpg" />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">点赞数</span>
            <input v-model.number="form.likes" type="number" min="0" step="1" class="studio-input" />
            <span class="text-xs text-zinc-500">影响「每日精选」的排序。</span>
          </label>

          <label class="flex items-center gap-2 pt-6">
            <input v-model="form.person" type="checkbox" class="h-4 w-4 rounded border-zinc-300" />
            <span class="text-sm text-zinc-700">人像题材</span>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">主题（逗号分隔）</span>
            <input v-model="form.themesText" type="text" class="studio-input" placeholder="室内，雾气" />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">风格（逗号分隔）</span>
            <input v-model="form.stylesText" type="text" class="studio-input" placeholder="写实，电影感" />
          </label>

          <label class="md:col-span-2 flex flex-col gap-1.5">
            <span class="text-sm font-medium text-zinc-700">提示词正文</span>
            <textarea
              v-model="form.prompt"
              rows="8"
              class="studio-input font-mono text-xs leading-relaxed"
              placeholder="一段中文描述… 变量写法：{argument name=&quot;主体&quot; default=&quot;茶客&quot;}"
            />
            <span class="text-xs text-zinc-500">
              支持 <code class="rounded bg-zinc-100 px-1">{argument name="变量" default="默认值"}</code> 占位，详情页会生成输入框。
            </span>
          </label>

          <p v-if="localError" class="md:col-span-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ localError }}</p>

          <div class="md:col-span-2 mt-2 flex items-center justify-end gap-2">
            <button type="button" class="studio-btn-secondary" @click="emit('close')">取消</button>
            <button type="submit" class="studio-btn-primary" :disabled="!canSubmit">
              {{ busy ? '保存中…' : '保存' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
