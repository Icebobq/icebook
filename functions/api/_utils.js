/** Pages Functions 共用的小工具：统一 JSON 响应 + 轻量限流 */

export function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * 每个 isolate 内的尽力限流。接口是公开的（谁打开站点都能调用），
 * 不设闸门的话很容易被拿去刷豆瓣/当当，导致出口 IP 被对方封掉。
 * 只在当前实例内计数，重启即清零，够挡脚本化的滥用。
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 60
const MAX_TRACKED_IPS = 2000
const hits = new Map()

export function allowRequest(request) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return false
  recent.push(now)
  if (hits.size >= MAX_TRACKED_IPS) hits.clear()
  hits.set(ip, recent)
  return true
}
