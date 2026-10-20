<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './base/AppIcon.vue'
import AppLogo from './base/AppLogo.vue'
import { ALL_LABEL } from '@/data/library'
import { useLibraryStore } from '@/stores/library'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()
const library = useLibraryStore()

const isHome = computed(() => route.name === 'home')
const isDiscover = computed(() => route.name === 'discover')
const isSubmit = computed(() => route.name === 'submit')

/** 分类树只在「发现提示词」下展开，当前层级取自 URL 查询参数 */
const activeMajor = computed(() => {
  const value = route.query.major
  return typeof value === 'string' ? value : ''
})
const activeCategory = computed(() => {
  const value = route.query.category
  return typeof value === 'string' ? value : ''
})

/** 手动展开的大类；当前所在的大类会在路由或数据变化时自动加入 */
const openGroups = ref<string[]>([])

/** 当前生效的大类：URL 有 major 用它；只有 category 时反查它所属的大类 */
const activeGroup = computed(() => {
  if (activeMajor.value) return activeMajor.value
  if (activeCategory.value) return library.majorOfCategory(activeCategory.value)
  return ''
})

watch(
  activeGroup,
  (major) => {
    if (major && !openGroups.value.includes(major)) {
      openGroups.value = [...openGroups.value, major]
    }
  },
  { immediate: true },
)

function isGroupOpen(major: string): boolean {
  return openGroups.value.includes(major)
}

/** 点大类名去筛选时，顺手把它展开 */
function ensureGroupOpen(major: string): void {
  if (!isGroupOpen(major)) openGroups.value = [...openGroups.value, major]
}

/** 箭头只负责折叠/展开，不触发导航 */
function toggleGroup(major: string): void {
  openGroups.value = isGroupOpen(major)
    ? openGroups.value.filter((name) => name !== major)
    : [...openGroups.value, major]
}

/** 点大类的公共处理：确保展开，并关闭移动端抽屉 */
function onMajorClick(major: string): void {
  ensureGroupOpen(major)
  ui.closeMobileNav()
}

function majorTarget(major: string) {
  return { name: 'discover' as const, query: { major } }
}

function categoryTarget(major: string, category: string) {
  return { name: 'discover' as const, query: { major, category } }
}

function allTarget() {
  return { name: 'discover' as const }
}
</script>

<template>
  <aside class="sidebar" :class="{ 'is-open': ui.mobileNavOpen }">
    <div class="sidebar-head">
      <AppLogo />
      <button
        class="icon-btn sidebar-close"
        type="button"
        aria-label="关闭菜单"
        @click="ui.closeMobileNav()"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <nav class="side-nav" aria-label="主要导航">
      <p class="nav-label">浏览</p>

      <RouterLink class="nav-item" :class="{ active: isHome }" to="/" @click="ui.closeMobileNav()">
        <AppIcon name="sparkles" /><span>每日精选</span>
      </RouterLink>

      <RouterLink
        class="nav-item"
        :class="{ active: isDiscover }"
        :to="allTarget()"
        @click="ui.closeMobileNav()"
      >
        <AppIcon name="grid" /><span>发现提示词</span>
        <small class="nav-chevron" :class="{ open: isDiscover }">›</small>
      </RouterLink>

      <div v-if="isDiscover" class="category-tree">
        <RouterLink
          class="nav-item"
          :class="{ 'sub-active': !activeGroup }"
          :to="allTarget()"
          @click="ui.closeMobileNav()"
        >
          <span class="category-dot is-all" />
          <span>{{ ALL_LABEL }}</span>
          <small>{{ library.total }}</small>
        </RouterLink>

        <div v-for="major in library.meta?.majors ?? []" :key="major.name" class="nav-group">
          <div class="nav-row">
            <RouterLink
              class="nav-item"
              :class="{ 'sub-active': activeGroup === major.name && !activeCategory }"
              :to="majorTarget(major.name)"
              @click="onMajorClick(major.name)"
            >
              <span class="category-dot" :style="{ background: major.main }" />
              <span>{{ major.name }}</span>
              <small>{{ major.count }}</small>
            </RouterLink>
            <button
              class="nav-caret"
              :class="{ 'is-open': isGroupOpen(major.name) }"
              type="button"
              :aria-expanded="isGroupOpen(major.name)"
              :aria-label="`${isGroupOpen(major.name) ? '收起' : '展开'}「${major.name}」的细分类`"
              @click="toggleGroup(major.name)"
            >
              <AppIcon name="chevron" :size="13" />
            </button>
          </div>

          <div v-if="isGroupOpen(major.name)" class="category-subs">
            <RouterLink
              v-for="sub in major.subs"
              :key="sub.name"
              class="nav-item"
              :class="{ 'sub-active': activeCategory === sub.name }"
              :to="categoryTarget(major.name, sub.name)"
              @click="ui.closeMobileNav()"
            >
              <span>{{ sub.name }}</span>
              <small>{{ sub.count }}</small>
            </RouterLink>
          </div>
        </div>
      </div>

      <div v-if="isDiscover" class="nav-divider" />

      <RouterLink
        class="nav-item"
        :class="{ active: isSubmit }"
        :to="{ name: 'submit' }"
        @click="ui.closeMobileNav()"
      >
        <AppIcon name="send" /><span>投稿</span>
      </RouterLink>
    </nav>

    <div class="sidebar-card">
      <span class="sidebar-card-icon"><AppIcon name="sparkles" /></span>
      <strong>每日灵感补给</strong>
      <p>
        全库 {{ library.total.toLocaleString('en-US') }} 条中文提示词，配效果图，一键复制即可开画。
      </p>
      <RouterLink to="/discover" @click="ui.closeMobileNav()">
        浏览全部 <AppIcon name="chevron" :size="14" />
      </RouterLink>
    </div>

    <div class="sidebar-footer">
      <span>© 2026 Copy2Draw</span>
      <button type="button" aria-label="切换语言"><AppIcon name="globe" :size="15" /> 中文</button>
    </div>
    <p class="sidebar-credit">
      数据来自
      <a href="https://github.com/BaYue-SYJ/shuixian-prompts" target="_blank" rel="noopener">
        水仙的AI提示词
      </a>
    </p>
  </aside>
</template>
