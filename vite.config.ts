import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { studioApi } from './vite-plugins/studio-api'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), studioApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // 内容覆盖层与生成产物由 /studio 写入，避免每次保存都整页刷新；
      // .deploy 是本地 git 凭据助手生成的目录，编译期的 CSC*.TMP 会被锁定，
      // watcher 一旦去 watch 就会抛 EBUSY 把整个 dev server 顶掉
      ignored: [
        '**/content/**',
        '**/public/data/**',
        '**/data/base/**',
        '**/dist/**',
        '**/.deploy/**',
        '**/*.TMP',
        '**/*.tmp',
      ],
    },
  },
})
