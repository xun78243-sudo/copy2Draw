import { fallbackImage } from '@/data/library'
import { useLibraryStore } from '@/stores/library'

/**
 * 图片兜底：图床上个别原图缺失（404）、或离线打开时，
 * 把 `<img>` 就地换成「分类配色渐变 + 首字」的 SVG 占位，避免出现破图图标与布局抖动。
 */
export function useImageFallback() {
  const library = useLibraryStore()

  function onImageError(event: Event, label: string, major?: string): void {
    const img = event.target
    if (!(img instanceof HTMLImageElement)) return
    if (img.dataset.fallbackApplied === '1') return
    img.dataset.fallbackApplied = '1'
    const palette = library.paletteOf(major ?? '')
    img.src = fallbackImage(label, palette.main, palette.bg)
  }

  return { onImageError }
}
