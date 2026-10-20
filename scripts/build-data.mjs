#!/usr/bin/env node
/**
 * 重建 public/data：基线（data/base）+ 覆盖层（content/）→ 分片 JSON。
 *
 *   npm run data:build            重建并自动备份
 *   npm run data:build -- --no-backup   不生成备份
 */
import { rebuild } from './lib/data-core.mjs'

const noBackup = process.argv.includes('--no-backup')

const result = rebuild({ backup: !noBackup })

if (!result.ok) {
  console.error('\n✗ 未写入任何文件，校验未通过：')
  for (const error of result.errors) console.error(`  · ${error}`)
  process.exit(1)
}

const stats = result.stats ?? {}
console.log('\n✓ 数据已重建')
console.log(`  条数     ${stats.total}（基线 ${stats.baseline}，新增 ${stats.added}，下架 ${stats.removed}，覆盖 ${stats.overridden}）`)
console.log(`  分片     ${stats.shards} 片 × 2（list + prompts），共 ${stats.files} 个文件`)
console.log(`  输出     public/data/`)
if (result.backup) console.log(`  备份     ${result.backup}`)
if (result.warnings.length > 0) {
  console.log('\n! 警告：')
  for (const warning of result.warnings) console.log(`  · ${warning}`)
}
