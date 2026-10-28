import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { coverApiMiddleware } from './server/httpApi.mjs'

/**
 * 开发服务器里也挂上 /api/covers，让豆瓣 / 当当的抓取在 dev 下和生产一致。
 * 纯静态托管时这个接口不存在，客户端会自动回落到直连 Google / Open Library。
 */
const coverApi = (): Plugin => ({
  name: 'icebook-cover-api',
  configureServer(server) {
    server.middlewares.use(coverApiMiddleware())
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), coverApi()],
})
