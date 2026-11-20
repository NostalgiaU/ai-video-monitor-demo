import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // HashRouter + 相对路径，方便部署到 GitHub Pages 等任意子路径
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'antd', test: /node_modules[\\/](antd|@ant-design|rc-|@rc-component)/ },
            { name: 'echarts', test: /node_modules[\\/](echarts|zrender)/ },
            { name: 'media', test: /node_modules[\\/](mpegts\.js|hls\.js)/ },
          ],
        },
      },
    },
  },
})
