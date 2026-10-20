# content —— 内容覆盖层

`public/data/` 下的 JSON 是**生成物**，不要手改。所有人工修改都放在这里：

| 路径 | 作用 |
| --- | --- |
| `added/<id>.json` | 新增提示词，一个文件一条（`/studio` 以分配的 id 命名） |
| `overrides/<id>.json` | 修改某条已有数据的字段 |
| `removed.json` | 下架列表 `{ "ids": [14347] }` |
| `.backup/` | 每次重建前的产物备份（已 gitignore，保留最近 10 份） |

改完执行 `npm run data:build` 重建，或在开发服务器打开 `/studio` 点点鼠标。`npm run data:check` 可校验覆盖层是否合法、产物是否已同步。

## 新增：`added/<id>.json`

```json
{
  "id": 100001,
  "title": "雾中茶室",
  "category": "中式美学",
  "major": "生活场景",
  "image": "images/local/tea-house-001.jpg",
  "images": ["images/local/tea-house-001-b.jpg"],
  "likes": 0,
  "person": false,
  "themes": ["室内", "雾气"],
  "styles": ["写实"],
  "prompt": "一张 {argument name=\"主体\" default=\"一位茶客\"} 的中式茶室照片"
}
```

- `id` 必须 ≥ `100001`（与上游稀疏 id 段错开），由 `/studio` 自动分配。
- `category` 已存在时忽略 `major`；新分类必须填 `major`，且必须是 `data/base/meta.json` 里 12 大类之一。
- `image` / `images[]` 写图床相对路径（如 `images/originals/14347.jpg`），也接受完整 `https://` 地址。

## 覆盖：`overrides/<id>.json`

```json
{ "id": 14347, "patch": { "title": "蹲在地上直视镜头（修订）", "likes": 120 } }
```

可改字段：`title`、`category`、`image`、`images`、`likes`、`person`、`themes`、`styles`、`prompt`。未列出的字段保持基线原值。

## 下架：`removed.json`

```json
{ "ids": [14347, 20981] }
```

同一条可以既下架又保留 `overrides/` 修改：**下架优先**（列表里消失），恢复后修改仍然生效。想彻底还原就删掉对应的 override 文件（`/studio` 里的「撤回修改」）。

## 基线

`data/base/` 是从上游「水仙的AI提示词」整体拷贝的只读基线。要同步上游更新，替换这 8 个文件后重建即可，覆盖层不受影响（id 冲突会被校验拦下）。
