# 复制即画 Copy2Draw

AI 图像提示词库的前端应用：浏览 **5,430 条中文提示词**、按 12 大类 / 79 细分类 / 主题 / 风格检索、一键复制（含变量替换）、收藏与下载图片，以及投稿入口。

界面沿用 Figma 原型（Next.js 16 + Payload CMS + Tailwind v4）中的**公开前台 UI**，重构为标准的 Vue 3 单页应用；数据接入开源项目 [水仙的AI提示词](https://github.com/BaYue-SYJ/shuixian-prompts) 的真实数据集与图床。

内容采用 **「只读基线 + 本地覆盖层」** 两层结构：上游 5,430 条数据原样保留，你自己的新增 / 修改 / 下架写在 `content/` 里，由 `npm run data:build` 合并成站点数据；日常维护可以直接用浏览器里的 `/studio` 后台点点鼠标完成。

## 技术栈

| 能力 | 选型 |
| --- | --- |
| 框架 | Vue 3.5（Composition API + `<script setup>` + TypeScript） |
| 构建 | Vite 7 |
| 路由 | Vue Router 4（History 模式） |
| 状态 | Pinia 3 |
| 样式 | 手写设计系统（`src/assets/main.css`）+ Tailwind CSS v4 工具类 |
| 类型检查 | vue-tsc |
| 内容维护 | 本地覆盖层（JSON）+ 开发期 `/studio` 后台（Vite 中间件，零额外依赖） |

## 快速开始

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 http://localhost:5173（含 /studio 后台）
npm run build        # 类型检查 + 生产构建，产物在 dist/
npm run preview      # 预览生产构建
npm run typecheck    # 仅做类型检查

npm run data:build   # 基线 + 覆盖层 → 重建 public/data
npm run data:check   # 校验覆盖层，并确认 public/data 与 content/ 同步
```

> 数据通过 `fetch` 读取 `public/data/` 下的 JSON，**必须走 HTTP**（`npm run dev` / `preview` 或任意静态服务器）；直接双击 `index.html` 会被跨域限制挡住。
> 图片走远程图床 `https://r2.qqsrc.com`，离线环境下卡片会退化为分类配色占位图，功能不受影响。

## 目录结构

```
.
├── index.html                 # 挂载点、SEO meta、字体预连接
├── vite.config.ts             # Vue + Tailwind 插件、@ 别名、dev 监听忽略、studio 接口注册
├── tsconfig.json              # 严格模式 + 路径别名
├── data
│   └── base                   # 上游数据集（只读基线，不参与部署）
│       ├── meta.json          # 12 大类 + 配色 + 热门词
│       ├── categories.json    # 79 细分类 → 大类映射与数量
│       ├── list.part1~3.json  # 轻量列表（无正文，约 1.4 MB）
│       └── prompts.part1~3.json # 完整数据（含正文，约 10.5 MB）
├── content                    # 内容覆盖层（你要维护的部分）
│   ├── added/                 # 新增条目，一条一个 JSON
│   ├── overrides/             # 对基线条目的字段修改
│   ├── removed.json           # 下架 id 列表
│   ├── .backup/               # 每次重建前的产物备份（保留最近 10 份，已 gitignore）
│   └── README.md              # 覆盖层文件格式说明
├── public
│   ├── favicon.svg
│   └── data                   # 【生成物】npm run data:build 的输出，前端运行时读取
├── scripts
│   ├── build-data.mjs         # 合并基线 + 覆盖层，重算计数，写分片
│   ├── check-data.mjs         # 校验覆盖层与产物同步状态（--images 可抽查图片）
│   └── lib/data-core.mjs      # 合并 / 校验 / 分片 / 备份的唯一实现（含 .d.mts 类型声明）
├── vite-plugins
│   └── studio-api.ts          # 仅开发期：/__studio/api 本地写盘接口
└── src
    ├── main.ts                # 应用入口：Pinia、Router、全局样式
    ├── App.vue                # 根组件：<RouterView> + 全局 Toast
    ├── assets/main.css        # 设计系统（设计令牌、卡片、栅格、分面、响应式、studio 控件）
    ├── router/index.ts        # 路由表、滚动行为、document.title 同步、studio 开关
    ├── types
    │   ├── prompt.ts          # Prompt / PromptDetail / 分类结构
    │   └── studio.ts          # /studio 与 /__studio/api 的数据契约
    ├── data/library.ts        # 纯函数数据层：图床地址、字段映射、变量解析、筛选排序、占位图
    ├── stores
    │   ├── library.ts         # 数据集分层加载 + 正文按需加载 + 详情缓存
    │   ├── favorites.ts       # 收藏（持久化到 localStorage）
    │   ├── toast.ts           # 全局轻提示
    │   └── ui.ts              # 移动端抽屉开关
    ├── composables
    │   ├── useStudioApi.ts    # /__studio/api 客户端
    │   ├── useClipboard.ts    # 复制（Clipboard API + execCommand 回退）
    │   ├── useDownloadImage.ts# 图片下载（fetch+Blob，失败回退新窗口）
    │   ├── usePromptActions.ts# 复制/收藏/下载一站式操作（含正文按需加载）
    │   ├── useIncrementalList.ts # 增量渲染：一次最多挂 N 张卡片
    │   ├── useImageFallback.ts   # 原图缺失时就地换成 SVG 占位
    │   ├── useVisitorStats.ts    # 站点访问计数（Vercount）与今日/累计数据
    │   └── usePageMeta.ts     # 动态标题与 description
    ├── layouts/DefaultLayout.vue # 侧边栏 + 移动顶栏 + <RouterView>
    ├── components
    │   ├── studio/StudioItemForm.vue # 新增/编辑表单（变量、图集、分类校验）
    │   ├── AppSidebar.vue        # 侧栏导航、12 大类可折叠的细分类树、投稿入口
    │   ├── MobileTopBar.vue      # 移动端顶栏
    │   ├── HeroSection.vue       # 首页 Hero、搜索、统计与分类快捷入口
    │   ├── CategoryFilterTabs.vue# 大类筛选标签
    │   ├── FloatingSearch.vue    # 发现页悬浮搜索
    │   ├── PromptMasonryCard.vue # 瀑布流卡片（每日精选）
    │   ├── PromptGridCard.vue    # 网格卡片（发现页）
    │   ├── PromptDetailActions.vue # 详情页四个操作按钮
    │   ├── VariableDialog.vue    # 「填变量并复制」弹窗
    │   ├── VisitorStatsCard.vue  # 投稿页右下角的访问统计卡
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
        ├── StudioView.vue      # 内容管理后台（仅开发环境）
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
| `/studio` | `studio` | 内容管理后台。**仅开发环境存在**（`import.meta.env.DEV`，或显式设置 `VITE_ENABLE_STUDIO=1`） |
| `/:pathMatch(.*)*` | `not-found` | 未匹配路径 |

## 内容维护（新增 / 修改 / 下架）

### 方式一：浏览器后台 `/studio`（推荐）

`npm run dev` 后打开 <http://localhost:5173/studio>：

- 左侧筛选（来源 / 大类 / 细分类 / 关键词），表格分页浏览 5,430 条数据；
- **新建**：填写标题、细分类（可选已有或输入新分类并指定大类）、图片路径、点赞、主题/风格、正文；
- **编辑**：基线条目会写入 `content/overrides/<id>.json`，新增条目直接改自己的文件；
- **下架 / 恢复**：基线条目写入 `content/removed.json`，随时可恢复；新增条目则是删除文件；
- **撤回修改**：删掉某条的覆盖补丁，回到上游原样；
- **图片体检**：对本页条目发 HEAD 请求，列出不可达的图片地址；
- 顶部「重建数据」把改动写入 `public/data/`，并显示条数 / 分片 / 备份信息，出错会列出具体文件。

> 写入的是本地文件，接口只在 `vite dev` 存在；生产构建里没有 `/studio` 路由，也没有 `/__studio/api`。

### 方式二：直接改文件

```bash
npm run data:build    # 合并 + 重算计数 + 重新分片 + 自动备份
npm run data:check    # 校验覆盖层与产物是否一致
```

三种覆盖层文件的格式见 [content/README.md](content/README.md)：

| 文件 | 作用 |
| --- | --- |
| `content/added/<id>.json` | 新增条目（id 从 100001 起，避开上游 id 段） |
| `content/overrides/<id>.json` | 修改基线条目的字段（标题/分类/图片/图集/点赞/主题/风格/正文） |
| `content/removed.json` | 下架 id 列表；与覆盖层可共存，**下架优先**，恢复后修改仍在 |

重建时的保证：

- **基线只读**：`data/base/` 不会被改写，清空 `content/` 重建可得到与上游逐字节一致的数据（`meta.json` 额外写入 `shards` 分片数）；
- **顺序稳定**：保留基线顺序，新增条目按 id 追加在末尾，不会打乱既有分片；
- **原子写 + 自动备份**：先写临时文件再改名，重建前把旧产物复制到 `content/.backup/<时间戳>/`（保留最近 10 份）；
- **校验失败不落盘**：id 冲突、未知分类、非法图片路径、覆盖/下架引用不存在的 id 等都会直接报错并保持产物不变；
- **分片自适应**：`meta.json` 新增 `shards` 字段（5,430 条为 3 片），前端按该字段加载，条目超过 2,000/片时自动增加分片。

## 数据来源与分层

数据来自 [水仙的AI提示词](https://github.com/BaYue-SYJ/shuixian-prompts)，`data/base/` 下的 8 个 JSON 是**上游 `shuixian-unified/data/` 的原样拷贝**，字段名保持不变，方便日后重新同步；`public/data/` 是合并后的生成物。

| 文件 | 内容 | 何时加载 |
| --- | --- | --- |
| `meta.json` | 总量、12 大类（含配色）、热门词、分片数 | 首屏 |
| `categories.json` | 79 细分类 → 所属大类 + 数量 | 首屏 |
| `list.part1~N.json` | `id / title / category / image / images / likes / themes / styles / person` | 首屏（约 1.4 MB） |
| `prompts.part1~N.json` | 在上面的字段外补充 `prompt` 正文 | 打开详情或点复制时（约 10.5 MB，只拉一次） |

- 图片字段是**相对路径**（如 `images/originals/14347.jpg`），由 `src/data/library.ts` 的 `IMAGE_BASE` 拼成完整地址，默认 `https://r2.qqsrc.com`；换自建图床时在 `.env` 里设 `VITE_IMAGE_BASE=https://your-cdn` 即可。新增图片仍需你自己上传到图床，`/studio` 只写路径。
- 正文里的 `{argument name="角色" default="Albedo"}` 是变量占位：详情页解析成表单，卡片上的复制按钮则用默认值补齐，粘出去就是能直接用的成品。
- 基线里有 9 张原图在上游图床缺失（404），`useImageFallback` 会就地替换成「分类配色渐变 + 首字」的 SVG，不会出现破图图标；`/studio` 的「图片体检」或 `npm run data:check -- --images` 可以批量排查。
- 数据源与你自己的改动分离后，重新同步上游只需替换 `data/base/` 的 8 个文件再 `npm run data:build`；若上游新数据与本地的 id 冲突，校验会拦下并指出文件。

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
| Payload CMS 后台（Next.js 服务端） | 前台纯静态；内容维护改为「本地覆盖层 + 开发期 `/studio`」，无需数据库与服务端 |
| `notFound()` 服务端渲染 404 | 路由兜底 + 详情页无效 id 共用 `NotFoundView` |
| Next `metadata` 静态声明 + `generateMetadata` | 路由 `meta.title` 统一处理，详情页用 `usePageMeta` 动态设置 |

同时补充的细节：

- 发现页原先没有 `<h1>`，新增视觉隐藏的主标题；搜索框支持回车触发，变量弹窗支持 `Esc` 关闭与打开后自动聚焦。
- 路由切换自动回到页首（`scrollBehavior`），并同步 `document.title`。
- 卡片操作统一使用 `@click.stop`，避免点收藏/复制时误触发跳转。
- 5,430 条数据一次挂载会卡，发现页采用「首屏 24 条 + 滚动到底自动追加 + 加载更多兜底」的增量渲染；筛选条件变化时自动回到第一页。
- 侧栏分类树按大类折叠：大类行本身负责筛选，箭头独立展开/收起它的细分类；当前大类自动展开，展开后由整条侧栏滚动（不再在树里套一层滚动条），「投稿」固定在所有分类之后。
- 开发服务器忽略 `content/`、`public/data/`、`data/base/` 的文件变化，避免 `/studio` 每次保存都整页刷新。

## 站点访问统计

投稿页右下角有一张统计卡（今日访问 / 总访问量 / 总访客数），数据来自
[Vercount](https://www.vercount.one/)（免费、无需注册、接口已开放 CORS），
实现在 [`src/composables/useVisitorStats.ts`](src/composables/useVisitorStats.ts)：

- 每次页面加载向 `https://events.vercount.one/api/v2/log` POST 一次 `{ url, isNewUv }`，
  返回 `{ site_pv, site_uv, page_pv }`；SPA 内部跳转不会再计数；
- `site_pv` → 总访问量，`site_uv` → 总访客数（1 年期 cookie 去重，cookie 名与官方 js 一致）；
- Vercount 没有按天字段，所以上报 URL 用 `{origin}/__stats/{YYYY-MM-DD}`：站点 PV 仍是一次访问记一次，
  而 `page_pv` 天然变成「今日」的计数桶；
- **本地/内网地址**（`localhost`、`127.0.0.1`、`192.168.x`、`*.local` 等）会把流量记到
  `https://copy2draw.invalid`（RFC 2606 保留域名）的演示桶里。原因：Vercount 对这类地址会回落到它自己的
  全站汇总桶，直接显示会看到上千万的别人的数据；改用演示桶后本地预览也能看到真实自增的小数字，
  上线后自动切回自己的域名；
- 请求失败或 6 秒超时会沿用 `localStorage` 里上一次的缓存值，没有缓存就显示「—」，不影响页面渲染；
- 只做一次浏览器端 POST，不采集任何个人信息；换自建统计时改这一个文件里的 `ENDPOINT` 与字段映射即可。

> 口径说明：「今日访问」是当日访问次数（刷新会累加），「总访客数」才是去重后的人数。
> Vercount 不提供按天的 UV，若需要「今日xx人」严格去重，得换服务或自建接口。

## 验证情况

- `npm run typecheck`、`npm run build` 均通过（无类型错误、无构建告警）；生产产物中不含 `/studio` 与 `/__studio/api`。
- 用 Chrome DevTools Protocol 在真实浏览器里跑了 **32 项功能断言**：首页 12 条瀑布流与真实 R2 图片加载、换一批轮转、发现页 24→48 增量加载、主题分面写 URL 并收窄结果、卡片复制按需取回正文且已替换变量、详情页正文保留原始占位、变量弹窗（2 个输入框 / 实时预览 / 复制成品 / 自动关闭）、缺失原图替换 SVG、无效 id 404、收藏刷新后保持、运行期零 console 错误。
- 同一套环境另跑 **22 项布局断言**：1440 / 1600 / 390 三种宽度下无横向滚动、侧边栏与移动顶栏显隐、瀑布流 3/1 列、网格 5/1 列、分面栏可见、移动抽屉可打开。
- 数据层 **34 项断言**：空覆盖层重建与上游逐字节一致、新增/覆盖/下架后的条数与分类计数正确、连续两次重建产物哈希一致、非法输入被拒绝且不写盘、清空覆盖层可完全还原。
- `/__studio/api` **37 项断言**：状态/检索/详情、新建（id 从 100001 递增）、字段覆盖、下架与恢复（含已修改条目）、撤回修改、重建、非法输入 400、不存在条目 404。
- `/studio` 界面 **23 项浏览器断言**：默认 24 行、搜索过滤、来源筛选、新建→待重建→重建→总数 +1、编辑后标题生效、图片体检返回、删除后回到基线、首页回归、零 console 错误。
- 数据层改造后回归 **24 项断言**：每日精选 12 张与换一批轮转、详情页正文按需加载、变量弹窗（输入→实时预览→复制成品→自动关闭）、无效 id 404、发现页 13 个大类标签与 URL 同步、悬浮搜索、收藏刷新后保持、零 console 错误。
- 生产产物 **8 项断言**：`/studio` 回落 404、接口不返回 JSON、首页与发现页数据正常加载。
- 投稿页访问统计卡 **22 项浏览器断言**：卡片贴右下角（桌面 24px / 移动 12px）、只发一次 POST、
  上报地址带按天分桶与演示桶、UV cookie 与本地缓存写入、SPA 内跳转不重复上报、
  首页与发现页不出现该卡片、移动端无横向滚动、零 console 错误。

## 署名与许可

本项目把「水仙的AI提示词」的数据集与分类体系用在了自己的界面上，按其
[署名使用协议](https://github.com/BaYue-SYJ/shuixian-prompts/blob/main/LICENSE) 保留署名：

> 本项目基于「水仙的AI提示词」（https://github.com/BaYue-SYJ/shuixian-prompts）二次开发

- 上游项目：<https://github.com/BaYue-SYJ/shuixian-prompts> · 站点 <https://prompt.qqsrc.com/>
- 站点侧边栏与本 README 均保留指向原仓库的链接。
- **提示词原文与图片版权归各自原作者**，上游项目仅做整理、分类与展示，本项目亦不对这部分内容主张权利；商用前请自行确认权利来源。
