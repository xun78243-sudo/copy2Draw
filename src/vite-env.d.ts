/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 图床域名，默认 https://r2.qqsrc.com；换自建图床时在 .env 里覆盖 */
  readonly VITE_IMAGE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
