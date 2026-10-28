import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { handleCoverApi, handleImageApi } from './httpApi.mjs'

/**
 * 生产环境：托管 dist/ 静态文件，并把 /api/covers 一起带上。
 * npm run build && npm run serve
 */

const root = resolve(process.cwd(), 'dist')
const port = Number(process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

async function sendFile(res, path, status = 200) {
  const body = await stat(path).catch(() => null)
  if (!body?.isFile()) return false
  res.writeHead(status, {
    'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.size,
    'cache-control': path.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
  })
  createReadStream(path).pipe(res)
  return true
}

const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/cover-image')) {
    await handleImageApi(req, res)
    return
  }
  if (req.url?.startsWith('/api/covers')) {
    await handleCoverApi(req, res)
    return
  }

  const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
  const target = normalize(join(root, pathname))

  // 目录穿越保护：解析后必须仍在 dist 里
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  if (pathname !== '/' && (await sendFile(res, target))) return
  if (await sendFile(res, join(root, 'index.html'), 200)) return
  res.writeHead(404).end('Not found')
})

server.listen(port, () => {
  console.log(`Icebook 已启动：http://localhost:${port}`)
})
