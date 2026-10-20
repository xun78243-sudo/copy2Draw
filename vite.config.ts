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
      // 内容覆盖层与生成产物由 /studio 写入，避免每次保存都整页刷新
      ignored: ['**/content/**', '**/public/data/**', '**/data/base/**', '**/dist/**'],
    },
  },
})
