import { watchEffect } from 'vue'

export interface PageMeta {
  /** 浏览器标题 */
  title: string
  /** meta description，可选 */
  description?: string
}

const DESCRIPTION_SELECTOR = 'meta[name="description"]'

/** 写入（或在缺失时创建）页面描述 */
function applyDescription(description: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR)
  if (!tag) {
    tag = document.createElement('meta')
    tag.name = 'description'
    document.head.appendChild(tag)
  }
  tag.content = description
}

/**
 * 声明式设置当前路由的 <title> / description。
 * 静态标题由路由 meta 统一处理，动态标题（如提示词详情）交给页面调用本函数。
 */
export function usePageMeta(resolve: () => PageMeta): void {
  watchEffect(() => {
    const { title, description } = resolve()
    document.title = title
    if (description) applyDescription(description)
  })
}
