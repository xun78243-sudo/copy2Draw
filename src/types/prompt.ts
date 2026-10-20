/**
 * 领域模型类型定义。
 *
 * 原始数据来自「水仙的AI提示词」（https://github.com/BaYue-SYJ/shuixian-prompts），
 * 字段名尽量与其 data/*.json 保持一一对应，方便后续同步数据集。
 */

/** 单个细分类（79 个），对应 data/categories.json 的一个 value */
export interface SubCategoryEntry {
  /** 该细分类下的提示词数量 */
  count: number
  /** 所属大类 */
  major: string
}

/** 大类下的细分类条目 */
export interface SubCategory {
  name: string
  count: number
}

/** 一个大类（12 个），对应 data/meta.json 的 majors[] */
export interface MajorCategory {
  name: string
  /** 该大类下的提示词数量 */
  count: number
  /** 主色，用于分类圆点与图片兜底渐变 */
  main: string
  /** 浅色背景 */
  bg: string
  /** 细分类列表 */
  subs: SubCategory[]
}

/** data/meta.json */
export interface LibraryMeta {
  total: number
  subCount: number
  /** 热门标签，用于首页快捷入口 */
  hot: string[]
  majors: MajorCategory[]
  /** 分类配色表：分类名 → 主色 / 浅底色 */
  colors: Record<string, { main: string; bg: string }>
  /** 分片数量（list.part1~N.json / prompts.part1~N.json），缺省按 3 处理 */
  shards?: number
}

/** data/list.part*.json 的条目：轻量列表，不含正文 */
export interface PromptRecordRaw {
  id: number
  title: string
  /** 细分类 */
  category: string
  /** 图床相对路径，如 images/originals/14347.jpg */
  image: string
  /** 同一提示词的额外效果图（相对路径） */
  images: string[]
  likes: number
  tweet: string | null
  /** 主题分面 */
  themes: string[]
  /** 风格分面 */
  styles: string[]
  /** 是否人像题材 */
  person: boolean
}

/** data/prompts.part*.json 的条目：在轻量条目上补充正文 */
export interface PromptDetailRaw extends PromptRecordRaw {
  thumb: string
  /** 原始模板正文，可含 {argument name="x" default="y"} 占位 */
  prompt: string
}

/** 列表视图模型：卡片与筛选使用 */
export interface Prompt {
  id: number
  title: string
  /** 细分类 */
  category: string
  /** 所属大类 */
  major: string
  themes: string[]
  styles: string[]
  /** themes + styles 合并，便于统一展示 */
  tags: string[]
  likes: number
  /** 图床相对路径 */
  imagePath: string
  /** 完整图片地址 */
  image: string
  /** 额外效果图的完整地址 */
  gallery: string[]
  person: boolean
}

/** 提示词中可替换的变量占位，用于「填变量并复制」弹窗 */
export interface PromptVariable {
  /** 变量名，来自 {argument name="…"} */
  name: string
  /** 默认值，来自 {argument ... default="…"}，可能为空字符串 */
  defaultValue: string
  /** 输入框占位文案 */
  placeholder: string
}

/** 详情视图模型：列表项 + 正文 + 解析出的变量 */
export interface PromptDetail extends Prompt {
  /** 原始模板正文（保留 {argument …} 占位） */
  prompt: string
  /** 从正文解析出的变量，可能为空数组 */
  variables: PromptVariable[]
}

/** 「发现提示词」的筛选条件，全部可选 */
export interface PromptFilters {
  /** 大类 */
  major?: string
  /** 细分类 */
  category?: string
  /** 主题分面 */
  theme?: string
  /** 风格分面 */
  style?: string
  /** 关键词 */
  query?: string
}
