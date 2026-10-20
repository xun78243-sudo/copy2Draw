<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { imageUrl } from '@/data/library'
import { studioApi } from '@/composables/useStudioApi'
import StudioItemForm from '@/components/studio/StudioItemForm.vue'
import type {
  StudioImageCheck,
  StudioItemDetail,
  StudioRow,
  StudioSavePayload,
  StudioState,
} from '@/types/studio'

const state = ref<StudioState | null>(null)
const rows = ref<StudioRow[]>([])
const total = ref(0)
const offset = ref(0)
const pageSize = ref(24)

const filters = reactive({ q: '', origin: 'all', major: '', category: '' })

const loading = ref(true)
const busy = ref(false)
const notice = ref('')
const errorText = ref('')

const formOpen = ref(false)
const editing = ref<StudioItemDetail | null>(null)

const checking = ref(false)
const imageIssues = ref<StudioImageCheck[] | null>(null)

const categoryOptions = computed(() => {
  const categories = state.value?.categories ?? {}
  const names = Object.keys(categories)
  const scoped = filters.major ? names.filter((name) => categories[name]?.major === filters.major) : names
  return scoped.sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const currentPage = computed(() => Math.floor(offset.value / pageSize.value) + 1)
const rangeStart = computed(() => (total.value === 0 ? 0 : offset.value + 1))
const rangeEnd = computed(() => Math.min(offset.value + rows.value.length, total.value))
const staleCount = computed(() => state.value?.stale.length ?? 0)
const dirty = computed(() => Boolean(state.value && (!state.value.synced || staleCount.value > 0)))

function fail(error: unknown): void {
  errorText.value = error instanceof Error ? error.message : String(error)
}

function flash(message: string): void {
  notice.value = message
  window.setTimeout(() => {
    if (notice.value === message) notice.value = ''
  }, 5000)
}

async function loadState(): Promise<void> {
  try {
    state.value = await studioApi.state()
  } catch (error) {
    fail(error)
  }
}

async function loadItems(): Promise<void> {
  loading.value = true
  try {
    const data = await studioApi.items({
      q: filters.q,
      origin: filters.origin,
      major: filters.major,
      category: filters.category,
      offset: offset.value,
      limit: pageSize.value,
    })
    rows.value = data.items
    total.value = data.total
  } catch (error) {
    fail(error)
  } finally {
    loading.value = false
  }
}

async function refresh(): Promise<void> {
  await Promise.all([loadState(), loadItems()])
}

let debounceTimer: number | undefined
watch(
  () => [filters.q, filters.origin, filters.major, filters.category],
  () => {
    if (filters.category && filters.major && state.value) {
      const major = state.value.categories[filters.category]?.major
      if (major && major !== filters.major) filters.category = ''
    }
    offset.value = 0
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => void loadItems(), 200)
  },
)

function changePage(delta: number): void {
  const next = offset.value + delta * pageSize.value
  offset.value = Math.max(0, Math.min(next, (pageCount.value - 1) * pageSize.value))
  void loadItems()
}

function changePageSize(): void {
  offset.value = 0
  void loadItems()
}

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

async function openEdit(row: StudioRow): Promise<void> {
  try {
    editing.value = await studioApi.item(row.id)
    formOpen.value = true
  } catch (error) {
    fail(error)
  }
}

async function save(payload: StudioSavePayload): Promise<void> {
  busy.value = true
  errorText.value = ''
  try {
    if (editing.value) {
      await studioApi.update(editing.value.id, payload)
      flash('修改已保存，点「重建数据」后生效')
    } else {
      const created = await studioApi.create(payload)
      flash(`已新增 #${created.id}，点「重建数据」后生效`)
    }
    formOpen.value = false
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function removeRow(row: StudioRow): Promise<void> {
  const isAdded = row.origin.includes('added')
  const confirmed = window.confirm(
    isAdded ? `删除新增条目 #${row.id}？content/added 里的文件会被移除。` : `下架 #${row.id}？之后可以随时恢复。`,
  )
  if (!confirmed) return
  busy.value = true
  try {
    await studioApi.remove(row.id)
    flash(isAdded ? '已删除新增条目' : '已下架，点「重建数据」后生效')
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function restoreRow(row: StudioRow): Promise<void> {
  busy.value = true
  try {
    await studioApi.restore(row.id)
    flash('已恢复上架，点「重建数据」后生效')
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function revertRow(row: StudioRow): Promise<void> {
  if (!window.confirm(`撤回 #${row.id} 上的字段修改？会删除 content/overrides 里的补丁。`)) return
  busy.value = true
  try {
    await studioApi.revert(row.id)
    flash('已撤回修改')
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function rebuild(): Promise<void> {
  busy.value = true
  errorText.value = ''
  try {
    const result = await studioApi.rebuild()
    if (!result.ok) {
      errorText.value = result.errors.join('；')
      return
    }
    const stats = result.stats
    flash(
      stats
        ? `重建完成：${stats.total.toLocaleString('en-US')} 条 · ${stats.shards} 片 · 共 ${stats.files} 个文件`
        : '重建完成',
    )
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

async function runImageCheck(): Promise<void> {
  checking.value = true
  errorText.value = ''
  try {
    const report = await studioApi.checkImages(rows.value.map((row) => row.id))
    imageIssues.value = report.failed
    flash(report.failed.length > 0 ? `${report.failed.length}/${report.checked} 张图片不可达` : `${report.checked} 张图片全部可达`)
  } catch (error) {
    fail(error)
  } finally {
    checking.value = false
  }
}

async function restoreBackup(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  const name = select.value
  select.value = ''
  if (!name) return
  if (!window.confirm(`用备份 ${name} 覆盖当前 public/data？覆盖前会自动再备份一次。`)) return
  busy.value = true
  try {
    await studioApi.restoreBackup(name)
    flash('已恢复备份，刷新页面即可看到')
    await refresh()
  } catch (error) {
    fail(error)
  } finally {
    busy.value = false
  }
}

function originLabels(origin: string[]): string[] {
  const labels: string[] = []
  if (origin.includes('added')) labels.push('新增')
  if (origin.includes('overridden')) labels.push('已修改')
  if (origin.includes('removed')) labels.push('已下架')
  if (labels.length === 0) labels.push('基线')
  return labels
}

onMounted(() => void refresh())
onBeforeUnmount(() => window.clearTimeout(debounceTimer))
</script>

<template>
  <div class="min-h-screen bg-zinc-50 text-zinc-950">
    <header class="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
        <div class="mr-auto">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">内容管理</p>
          <h1 class="text-lg font-semibold leading-tight">提示词库 · Studio</h1>
        </div>

        <span
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="dirty ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'"
        >
          <template v-if="dirty">待重建 {{ staleCount }} 个文件</template>
          <template v-else>已同步 · {{ (state?.total ?? 0).toLocaleString('en-US') }} 条</template>
        </span>

        <button type="button" class="studio-btn-primary" :disabled="busy" @click="rebuild">
          重建数据
        </button>

        <select
          v-if="state?.backups.length"
          class="studio-input w-auto text-xs"
          aria-label="恢复备份"
          @change="restoreBackup"
        >
          <option value="">恢复备份…</option>
          <option v-for="backup in state.backups" :key="backup.name" :value="backup.name">
            {{ backup.name }}（{{ backup.files }} 个文件）
          </option>
        </select>

        <button type="button" class="studio-btn-secondary" :disabled="checking || loading" @click="runImageCheck">
          {{ checking ? '检查中…' : '图片体检本页' }}
        </button>

        <RouterLink to="/" class="text-sm font-medium text-zinc-500 transition hover:text-zinc-900">返回站点</RouterLink>
      </div>

      <div v-if="dirty" class="border-t border-amber-100 bg-amber-50/70">
        <div class="mx-auto max-w-[1400px] px-4 py-2 text-xs text-amber-800">
          有改动尚未写入 public/data：{{ state?.stale.map((item) => item.file).join('、') }}
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1400px] px-4 py-6">
      <p v-if="errorText" class="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
        <span>{{ errorText }}</span>
        <button type="button" class="text-rose-500" aria-label="关闭" @click="errorText = ''">✕</button>
      </p>
      <p v-if="notice" class="mb-4 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white">{{ notice }}</p>
      <p v-if="state?.errors.length" class="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
        <strong class="mr-1">校验未通过：</strong>{{ state.errors.join('；') }}
      </p>
      <p v-if="state?.warnings.length" class="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
        <strong class="mr-1">提示：</strong>{{ state.warnings.join('；') }}
      </p>

      <section v-if="imageIssues" class="mb-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold">图片体检结果</h2>
          <button type="button" class="text-xs text-zinc-500 hover:text-zinc-900" @click="imageIssues = null">关闭</button>
        </div>
        <p v-if="imageIssues.length === 0" class="text-sm text-emerald-700">本页图片全部可达。</p>
        <ul v-else class="space-y-1 text-xs">
          <li v-for="item in imageIssues" :key="`${item.id}-${item.path}`" class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-zinc-500">#{{ item.id }}</span>
            <span class="text-zinc-700">{{ item.title }}</span>
            <a :href="item.url" target="_blank" rel="noopener" class="truncate font-mono text-rose-600 hover:underline">{{ item.url }}</a>
            <span class="text-zinc-400">HTTP {{ item.status }}</span>
          </li>
        </ul>
      </section>

      <section class="rounded-3xl bg-white ring-1 ring-zinc-200">
        <div class="flex flex-wrap items-end gap-3 border-b border-zinc-100 p-4">
          <label class="flex min-w-[220px] flex-1 flex-col gap-1">
            <span class="text-xs font-medium text-zinc-500">搜索（标题 / 分类 / id）</span>
            <input v-model="filters.q" type="search" class="studio-input" placeholder="输入关键词后自动过滤" />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-500">来源</span>
            <select v-model="filters.origin" class="studio-input w-36">
              <option value="all">全部</option>
              <option value="added">仅新增</option>
              <option value="overridden">仅已修改</option>
              <option value="removed">仅已下架</option>
              <option value="baseline">仅基线</option>
            </select>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-500">大类</span>
            <select v-model="filters.major" class="studio-input w-40">
              <option value="">全部大类</option>
              <option v-for="major in state?.majors ?? []" :key="major.name" :value="major.name">{{ major.name }}</option>
            </select>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-500">细分类</span>
            <select v-model="filters.category" class="studio-input w-44">
              <option value="">全部细分类</option>
              <option v-for="name in categoryOptions" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-zinc-500">每页</span>
            <select v-model.number="pageSize" class="studio-input w-24" @change="changePageSize">
              <option :value="24">24</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>

          <button type="button" class="studio-btn-primary ml-auto" @click="openCreate">＋ 新建提示词</button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th class="w-16 px-4 py-2 font-medium">图</th>
                <th class="px-2 py-2 font-medium">标题</th>
                <th class="w-40 px-2 py-2 font-medium">分类 / 大类</th>
                <th class="w-20 px-2 py-2 font-medium">点赞</th>
                <th class="w-32 px-2 py-2 font-medium">来源</th>
                <th class="w-56 px-4 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="px-4 py-10 text-center text-sm text-zinc-400">加载中…</td>
              </tr>
              <tr v-else-if="rows.length === 0">
                <td colspan="6" class="px-4 py-10 text-center text-sm text-zinc-400">没有匹配的条目</td>
              </tr>
              <template v-else>
                <tr
                  v-for="row in rows"
                  :key="row.id"
                  class="border-t border-zinc-100 align-middle"
                  :class="{ 'opacity-60': row.removed }"
                >
                <td class="px-4 py-2">
                  <img
                    v-if="row.image"
                    :src="imageUrl(row.image)"
                    alt=""
                    loading="lazy"
                    class="h-12 w-12 rounded-lg object-cover ring-1 ring-zinc-200"
                  />
                  <span v-else class="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">无图</span>
                </td>
                <td class="max-w-[360px] px-2 py-2">
                  <p class="truncate font-medium text-zinc-900">{{ row.title }}</p>
                  <p class="text-xs text-zinc-400">#{{ row.id }}</p>
                </td>
                <td class="px-2 py-2 text-xs text-zinc-600">
                  <p class="truncate">{{ row.category }}</p>
                  <p class="truncate text-zinc-400">{{ row.major || '未归类' }}</p>
                </td>
                <td class="px-2 py-2 text-xs text-zinc-600">{{ row.likes }}</td>
                <td class="px-2 py-2">
                  <span
                    v-for="label in originLabels(row.origin)"
                    :key="label"
                    class="mr-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="{
                      'bg-violet-50 text-violet-700': label === '新增',
                      'bg-sky-50 text-sky-700': label === '已修改',
                      'bg-rose-50 text-rose-700': label === '已下架',
                      'bg-zinc-100 text-zinc-500': label === '基线',
                    }"
                  >{{ label }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <div class="inline-flex flex-wrap items-center justify-end gap-1">
                    <button type="button" class="studio-link" @click="openEdit(row)">编辑</button>
                    <button
                      v-if="row.origin.includes('overridden')"
                      type="button"
                      class="studio-link text-amber-600"
                      @click="revertRow(row)"
                    >撤回修改</button>
                    <button
                      v-if="row.removed"
                      type="button"
                      class="studio-link text-emerald-600"
                      @click="restoreRow(row)"
                    >恢复</button>
                    <button
                      v-else
                      type="button"
                      class="studio-link text-rose-600"
                      @click="removeRow(row)"
                    >{{ row.origin.includes('added') ? '删除' : '下架' }}</button>
                  </div>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
          <span>第 {{ rangeStart }}–{{ rangeEnd }} 条 / 共 {{ total.toLocaleString('en-US') }} 条</span>
          <div class="flex items-center gap-2">
            <button type="button" class="studio-btn-secondary" :disabled="currentPage <= 1 || loading" @click="changePage(-1)">上一页</button>
            <span>{{ currentPage }} / {{ pageCount }}</span>
            <button type="button" class="studio-btn-secondary" :disabled="currentPage >= pageCount || loading" @click="changePage(1)">下一页</button>
          </div>
        </div>
      </section>

      <p class="mt-4 text-xs text-zinc-400">
        数据源：<code class="rounded bg-zinc-200/60 px-1">data/base/</code>（只读基线）+
        <code class="rounded bg-zinc-200/60 px-1">content/</code>（你的增删改）。
        每次修改都要点「重建数据」才会写入 <code class="rounded bg-zinc-200/60 px-1">public/data/</code>。
      </p>
    </main>

    <StudioItemForm
      :open="formOpen"
      :item="editing"
      :categories="state?.categories ?? {}"
      :majors="state?.majors ?? []"
      :busy="busy"
      @close="formOpen = false"
      @save="save"
    />
  </div>
</template>
