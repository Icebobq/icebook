/**
 * 封面接口的共用逻辑：参数校验、缓存、结果形状。
 *
 * 这里不碰 req/res，只吃 URLSearchParams、吐 { status, payload }，
 * 因此 Node（server/httpApi.mjs）和 Cloudflare Pages Functions
 * （functions/api/*.js）可以共用同一份实现。
 */

import { fetchImage, searchCover } from './coverSources.mjs'

/** 同一本书的查询结果在内存里留一天，避免批量同步时重复打外部接口 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_LIMIT = 300

const coverCache = new Map()
const imageCache = new Map()

function remember(map, key, value) {
  if (map.size >= CACHE_LIMIT) {
    const oldest = map.keys().next()
    if (!oldest.done) map.delete(oldest.value)
  }
  map.set(key, value)
}

/**
 * GET /api/covers?title=活着&author=余华
 * 200 → { title, source, coverUrl, isbn, image: { mime, data } | null }
 * 404 → 明确表示没找到（客户端据此停止回退，直接记“已检查”）
 */
export async function resolveCover(params) {
  const title = (params.get('title') ?? '').trim().slice(0, 120)
  const author = (params.get('author') ?? '').trim().slice(0, 80)
  if (!title) return { status: 400, payload: { error: 'title-required' } }

  const key = `${title}\u0000${author}`
  const cached = coverCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result

  try {
    const found = await searchCover({ title, author })
    const result = !found
      ? { status: 404, payload: { error: 'not-found' } }
      : {
          status: 200,
          payload: {
            title,
            source: found.source,
            coverUrl: found.coverUrl,
            isbn: found.isbn ?? null,
            // 下载失败时前端仍可用 coverUrl 直接显示
            image: (await fetchImage(found.coverUrl)) ?? null,
          },
        }
    remember(coverCache, key, { result, at: Date.now() })
    return result
  } catch (error) {
    return {
      status: 502,
      payload: { error: 'upstream-failed', message: String(error?.message ?? error) },
    }
  }
}

/**
 * GET /api/cover-image?url=<封面原始地址>
 * 200 → { image: { mime, data } }；404 → 下载失败或域名不在白名单。
 * 只下载书里已经记下的那张图，不重新检索，保证和原有封面一致。
 */
export async function resolveImage(params) {
  const url = (params.get('url') ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return { status: 400, payload: { error: 'bad-url' } }

  const cached = imageCache.get(url)
  if (cached) return cached

  const image = await fetchImage(url)
  if (!image) return { status: 404, payload: { error: 'not-found' } }

  const result = { status: 200, payload: { image } }
  remember(imageCache, url, result)
  return result
}
