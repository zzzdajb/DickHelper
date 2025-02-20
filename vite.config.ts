import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // 修改这里
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,  // 添加这行以便调试
    minify: true
  }
})
