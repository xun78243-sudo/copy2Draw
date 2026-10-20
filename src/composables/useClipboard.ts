/**
 * 复制文本到剪贴板。
 * 优先使用异步 Clipboard API，被浏览器拒绝（非安全上下文 / 无权限）时
 * 回退到隐藏 textarea + execCommand，行为与原型一致。
 */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // 继续走回退方案
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    document.execCommand('copy')
  } finally {
    area.remove()
  }
}
