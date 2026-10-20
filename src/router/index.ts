import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    /** 路由级页面标题，写入 document.title */
    title?: string
  }
}

/** 站点默认标题，未声明 meta.title 的路由回退到该值 */
const SITE_TITLE = '复制即画 Copy2Draw'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: SITE_TITLE },
      },
      {
        path: 'discover',
        name: 'discover',
        component: () => import('@/views/DiscoverView.vue'),
        meta: { title: `发现提示词｜${SITE_TITLE}` },
      },
      {
        path: 'submit',
        name: 'submit',
        component: () => import('@/views/SubmitView.vue'),
        meta: { title: `投稿提示词｜${SITE_TITLE}` },
      },
    ],
  },
  {
    // 详情页为独立全宽布局，标题由页面内的 usePageMeta 动态设置
    path: '/detail/:id',
    name: 'prompt-detail',
    component: () => import('@/views/PromptDetailView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: `页面不存在｜${SITE_TITLE}` },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = to.meta.title
  if (typeof title === 'string' && title) document.title = title
})

export default router
