import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径：GitHub Pages 子路径部署（https://<user>.github.io/<repo>/）与本地 file:// 均可工作
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 4000,
  },
})
