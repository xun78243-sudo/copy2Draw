/**
 * 下载图片。
 * 先尝试 fetch + Blob 触发浏览器下载（可指定文件名），
 * 跨域受限时退回新窗口打开原图，与原型行为一致。
 */
export async function downloadImage(src: string, filename: string): Promise<void> {
  const name = `${sanitize(filename)}.${extensionOf(src)}`

  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`下载失败：${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(src, '_blank', 'noopener,noreferrer')
  }
}

/** 从地址里取扩展名，取不到时按 jpg 处理 */
function extensionOf(src: string): string {
  const match = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(src)
  return match ? match[1].toLowerCase() : 'jpg'
}

/** 去掉文件名里的非法字符 */
function sanitize(filename: string): string {
  const cleaned = filename.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  return cleaned || 'copy2draw'
}
