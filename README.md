# 复制即画 Copy2Draw

AI 图像提示词库的前端应用：浏览 **5,430 条中文提示词**、按 12 大类 / 79 细分类 / 主题 / 风格检索、一键复制（含变量替换）、收藏与下载图片，以及投稿入口。

界面沿用 Figma 原型（Next.js 16 + Payload CMS + Tailwind v4）中的**公开前台 UI**，重构为标准的 Vue 3 单页应用；数据接入开源项目 [水仙的AI提示词](https://github.com/BaYue-SYJ/shuixian-prompts) 的真实数据集与图床。

## 技术栈

| 能力 | 选型 |
| --- | --- |
| 框架 | Vue 3.5（Composition API + `<script setup>` + TypeScript） |
| 构建 | Vite 7 |
| 路由 | Vue Router 4（History 模式） |
| 状态 | Pinia 3 |
| 样式 | 手写设计系统（`src/assets/main.css`）+ Tailwind CSS v4 工具类 |
| 类型检查 | vue-tsc |

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建，产物在 dist/
npm run preview  # 预览生产构建
npm run typecheck # 仅做类型检查
```

> 数据通过 `fetch` 读取 `public/data/` 下的 JSON，**必须走 HTTP**（`npm run dev` / `preview` 或任意静态服务器）；直接双击 `index.html` 会被跨域限制挡住。
> 图片走远程图床 `https://r2.qqsrc.com`，离线环境下卡片会退化为分类配色占位图，功能不受影响。

## 目录结构

```
.
├── index.html                 # 挂载点、SEO meta、字体预连接
├── vite.config.ts             # Vue + Tailwind 插件、@ 别名
├── tsconfig.json              # 严格模式 + 路径别名
├── public
│   ├── favicon.svg
│   └── data                   # 数据集（从上游仓库整体复制，见「数据来源」）
│       ├── meta.json          # 12 大类 + 配色 + 热门词
│       ├── categories.json    # 79 细分类 → 大类映射
│       ├── list.part1~3.json  # 5430 条轻量列表（无正文，约 1.4 MB）
│       └── prompts.part1~3.json # 5430 条完整数据（含正文，约 10.5 MB）
└── src
    ├── main.ts                # 应用入口：Pinia、Router、全局样式
    ├── App.vue                # 根组件：<RouterView> + 全局 Toast
    ├── assets/main.css        # 设计系统（设计令牌、侧边栏、卡片、栅格、分面、骨架屏、响应式）
    ├── router/index.ts        # 路由表、滚动行为、document.title 同步
    ├── types/prompt.ts        # Prompt / PromptDetail / PromptVariable / 分类结构类型
    ├── data/library.ts        # 纯函数数据层：图床地址、字段映射、变量解析、筛选排序、占位图
    ├── stores
    │   ├── library.ts         # 数据集分层加载 + 正文按需加载 + 详情缓存
    │   ├── favorites.ts       # 收藏（持久化到 localStorage）
    │   ├── toast.ts           # 全局轻提示
    │   └── ui.ts              # 移动端抽屉开关
    ├── composables
    │   ├── useClipboard.ts    # 复制（Clipboard API + execCommand 回退）
    │   ├── useDownloadImage.ts# 图片下载（fetch+Blob，失败回退新窗口）
    │   ├── usePromptActions.ts# 复制/收藏/下载一站式操作（含正文按需加载）
    │   ├── useIncrementalList.ts # 增量渲染：一次最多挂 N 张卡片
    │   ├── useImageFallback.ts   # 原图缺失时就地换成 SVG 占位
    │   └── usePageMeta.ts     # 动态标题与 description
    ├── layouts/DefaultLayout.vue # 侧边栏 + 移动顶栏 + <RouterView>
    ├── components
    │   ├── AppSidebar.vue        # 侧栏导航、12 大类与细分类树
    │   ├── MobileTopBar.vue      # 移动端顶栏
    │   ├── HeroSection.vue       # 首页 Hero、搜索、统计与分类快捷入口
    │   ├── CategoryFilterTabs.vue# 大类筛选标签
    │   ├── FloatingSearch.vue    # 发现页悬浮搜索
    │   ├── PromptMasonryCard.vue # 瀑布流卡片（每日精选）
    │   ├── PromptGridCard.vue    # 网格卡片（发现页）
    │   ├── PromptDetailActions.vue # 详情页四个操作按钮
    │   ├── VariableDialog.vue    # 「填变量并复制」弹窗
    │   └── base
    │       ├── AppIcon.vue / icons.ts # 线性图标集
    │       ├── AppLogo.vue
    │       ├── EmptyState.vue
    │       └── AppToast.vue
    └── views
        ├── HomeView.vue        # 每日精选（高赞池 + 换一批 + 搜索）
        ├── DiscoverView.vue    # 发现提示词（大类 / 细分类 / 主题 / 风格 / 关键词）
        ├── SubmitView.vue      # 投稿须知与邮箱
        ├── PromptDetailView.vue# 提示词详情 + 同类推荐
        └── NotFoundView.vue    # 404（路由兜底与无效 id 共用）
```

## 路由

| 路径 | 名称 | 说明 |
| --- | --- | --- |
| `/` | `home` | 每日精选：Hero + 高赞瀑布流 12 条 + 换一批 |
| `/discover` | `discover` | 发现提示词：大类标签、主题/风格分面、细分类、关键词 |
| `/discover?major=人物写真` | `discover` | 按大类筛选 |
| `/discover?major=海报广告&category=城市海报&theme=海报&style=写实&q=赛博` | `discover` | 全部筛选条件写入 URL，可分享、可刷新保持 |
| `/submit` | `submit` | 投稿须知与投稿邮箱 |
| `/detail/:id` | `prompt-detail` | 详情页（全宽布局，无侧边栏），id 为上游数据集的原始 id |
| `/:pathMatch(.*)*` | `not-found` | 未匹配路径 |

## 数据来源与分层

数据来自 [水仙的AI提示词](https://github.com/BaYue-SYJ/shuixian-prompts)，`public/data/` 下的 8 个 JSON 是**上游 `shuixian-unified/data/` 的原样拷贝**，字段名保持不变，方便日后重新同步。

| 文件 | 内容 | 何时加载 |
| --- | --- | --- |
| `meta.json` | 总量、12 大类（含配色）、热门词 | 首屏 |
| `categories.json` | 79 细分类 → 所属大类 + 数量 | 首屏 |
| `list.part1~3.json` | `id / title / category / image / images / likes / themes / styles / person` | 首屏（约 1.4 MB） |
| `prompts.part1~3.json` | 在上面的字段外补充 `prompt` 正文 | 打开详情或点复制时（约 10.5 MB，只拉一次） |

- 图片字段是**相对路径**（如 `images/originals/14347.jpg`），由 `src/data/library.ts` 的 `IMAGE_BASE` 拼成完整地址，默认 `https://r2.qqsrc.com`；换自建图床时在 `.env` 里设 `VITE_IMAGE_BASE=https://your-cdn` 即可。
- 正文里的 `{argument name="角色" default="Albedo"}` 是变量占位：详情页解析成表单，卡片上的复制按钮则用默认值补齐，粘出去就是能直接用的成品。
- 5430 张原图里有 9 张在上游图床缺失（404），`useImageFallback` 会就地替换成「分类配色渐变 + 首字」的 SVG，不会出现破图图标。

## 与原型的主要转换决策

| 原型（Next.js） | 本项目（Vue） |
| --- | --- |
| `useState<'daily' \| 'discover' \| 'submit'>` 手动切视图 | 拆成 `/`、`/discover`、`/submit` 三条真实路由，状态与 URL 一致 |
| `next/navigation` 的 `useRouter` / `Link` | `vue-router` 的 `useRouter` / `RouterLink` |
| `'use client'` 组件混用 | 全部为 SFC；交互状态用 `ref` / `computed`，跨组件用 Pinia |
| 单文件 `PromptLibrary.tsx` 承载三种视图 | 视图、布局、卡片、弹窗各自独立组件 |
| 收藏用组件内 `Set`，刷新即丢失 | `stores/favorites.ts`：Pinia + `localStorage` 持久化 |
| 复制/下载逻辑在两处重复 | 收敛为 `usePromptActions` + `useClipboard` / `useDownloadImage` |
| 侧栏「投稿」切到内联视图，`/submit` 另有一份页面 | 合并为 `/submit` 路由（保留更完整的「投稿须知」版本） |
| 分类写死 6 个、计数硬编码 | 从 `meta.json` / `categories.json` 生成 12 大类 + 79 细分类，计数取自真实数据 |
| 静态 8 条示例数据 + Unsplash 图 | 接入上游 5,430 条数据集与 R2 图床，按需增量渲染 |
| `notFound()` 服务端渲染 404 | 路由兜底 + 详情页无效 id 共用 `NotFoundView` |
| Next `metadata` 静态声明 + `generateMetadata` | 路由 `meta.title` 统一处理，详情页用 `usePageMeta` 动态设置 |

同时补充的细节：

- 发现页原先没有 `<h1>`，新增视觉隐藏的主标题；搜索框支持回车触发，变量弹窗支持 `Esc` 关闭与打开后自动聚焦。
- 路由切换自动回到页首（`scrollBehavior`），并同步 `document.title`。
- 卡片操作统一使用 `@click.stop`，避免点收藏/复制时误触发跳转。
- 5,430 条数据一次挂载会卡，发现页采用「首屏 24 条 + 滚动到底自动追加 + 加载更多兜底」的增量渲染；筛选条件变化时自动回到第一页。
- 侧边栏细分类树限制高度并可滚动，避免 79 条细分类撑破抽屉。

## 验证情况

- `npm run typecheck`、`npm run build` 均通过（无类型错误、无构建告警）。
- 用 Chrome DevTools Protocol 在真实浏览器里跑了 **32 项功能断言**：首页 12 条瀑布流与真实 R2 图片加载、换一批轮转、发现页 24→48 增量加载、主题分面写 URL 并收窄结果、卡片复制按需取回正文且已替换变量、详情页正文保留原始占位、变量弹窗（2 个输入框 / 实时预览 / 复制成品 / 自动关闭）、缺失原图替换 SVG、无效 id 404、收藏刷新后保持、运行期零 console 错误。
- 同一套环境另跑 **22 项布局断言**：1440 / 1600 / 390 三种宽度下无横向滚动、侧边栏与移动顶栏显隐、瀑布流 3/1 列、网格 5/1 列、分面栏可见、移动抽屉可打开。

## 署名与许可

本项目把「水仙的AI提示词」的数据集与分类体系用在了自己的界面上，按其
[署名使用协议](https://github.com/BaYue-SYJ/shuixian-prompts/blob/main/LICENSE) 保留署名：

> 本项目基于「水仙的AI提示词」（https://github.com/BaYue-SYJ/shuixian-prompts）二次开发

- 上游项目：<https://github.com/BaYue-SYJ/shuixian-prompts> · 站点 <https://prompt.qqsrc.com/>
- 站点侧边栏与本 README 均保留指向原仓库的链接。
- **提示词原文与图片版权归各自原作者**，上游项目仅做整理、分类与展示，本项目亦不对这部分内容主张权利；商用前请自行确认权利来源。
