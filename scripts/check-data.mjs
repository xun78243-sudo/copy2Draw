#!/usr/bin/env node
/**
 * 数据一致性检查：校验覆盖层，并确认 public/data 与 content/ 同步。
 *
 *   npm run data:check              结构 + 引用 + 同步状态
 *   npm run data:check -- --images  额外抽查图片可达性（默认 50 张）
 *   npm run data:check -- --images 200
 */
import { checkCurrent, checkImages, loadBase, loadContent } from './lib/data-core.mjs'

const args = process.argv.slice(2)
const imageArgIndex = args.indexOf('--images')
const checkImageFlag = imageArgIndex !== -1
const sampleSize = Number(args[imageArgIndex + 1]) > 0 ? Number(args[imageArgIndex + 1]) : 50

const result = checkCurrent()
let failed = false

if (result.errors.length > 0) {
  console.error('✗ 校验未通过：')
  for (const error of result.errors) console.error(`  · ${error}`)
  process.exit(1)
}

if (result.warnings.length > 0) {
  console.log('! 警告：')
  for (const warning of result.warnings) console.log(`  · ${warning}`)
}

if (result.ok) {
  const stats = result.stats ?? {}
  console.log(
    `✓ 数据一致：${stats.total} 条（基线 ${stats.baseline}，新增 ${stats.added}，下架 ${stats.removed}，覆盖 ${stats.overridden}），${stats.shards} 片`,
  )
} else {
  failed = true
  console.error('✗ public/data 与 content/ 不同步，需要运行 npm run data:build：')
  for (const item of result.stale) console.error(`  · ${item.file}：${item.reason}`)
}

if (checkImageFlag) {
  const base = loadBase()
  const content = loadContent()
  const ids = new Set()
  for (const { data } of content.added) ids.add(data.id)
  for (const { data } of content.overrides) ids.add(data.id)
  const sample = base.records.slice(0, Math.max(0, sampleSize - ids.size))
  for (const record of sample) ids.add(record.id)

  console.log(`\n· 抽查 ${ids.size} 条记录的图片（HEAD，失败会列出地址）…`)
  const report = await checkImages([...ids])
  if (report.failed.length === 0) {
    console.log(`✓ 图片全部可达（${report.checked} 张）`)
  } else {
    failed = true
    console.error(`✗ ${report.failed.length}/${report.checked} 张图片不可达：`)
    for (const item of report.failed) {
      console.error(`  · #${item.id} ${item.title} → ${item.url}（HTTP ${item.status}）`)
    }
    console.log('\n  提示：可在 /studio 的「图片体检」里改路径或下架该条。')
  }
}

process.exit(failed ? 1 : 0)
