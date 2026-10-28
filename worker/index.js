/**
 * Cloudflare Worker 入口：/api/* 走封面代理，其余交给静态资源（dist/）。
 * 静态资源由 [assets] 配置托管，找不到的路径由
 * not_found_handling = "single-page-application" 回退到 index.html。
 */

import { resolveCover, resolveImage } from '../server/coverApi.mjs'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS })
}

/**
 * 每个 isolate 内的尽力限流。接口是公开的，不设闸门容易被拿去刷豆瓣/当当，
 * 反过来把出口 IP 拖黑，最后自己也没封面可用。重启即清零，够挡脚本滥用。
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const MAX_TRACKED_IPS = 2000
const hits = new Map()

function allowRequest(request) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return false
  recent.push(now)
  if (hits.size >= MAX_TRACKED_IPS) hits.clear()
  hits.set(ip, recent)
  return true
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/covers' || url.pathname === '/api/cover-image') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return json(405, { error: 'method-not-allowed' })
      }
      if (!allowRequest(request)) return json(429, { error: 'too-many-requests' })

      const { status, payload } =
        url.pathname === '/api/covers'
          ? await resolveCover(url.searchParams)
          : await resolveImage(url.searchParams)
      return json(status, payload)
    }

    return env.ASSETS.fetch(request)
  },
}
