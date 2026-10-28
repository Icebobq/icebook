import { resolveCover, resolveImage } from './coverApi.mjs'

/** Node 侧的薄适配层：把 resolveCover/resolveImage 的 { status, payload } 写回 res */

function respond(res, { status, payload }) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function methodAllowed(req) {
  return req.method === 'GET' || req.method === 'HEAD'
}

function searchParamsOf(req) {
  try {
    return new URL(req.url ?? '/', 'http://localhost').searchParams
  } catch {
    return null
  }
}

export async function handleCoverApi(req, res) {
  if (!methodAllowed(req)) {
    respond(res, { status: 405, payload: { error: 'method-not-allowed' } })
    return
  }
  const params = searchParamsOf(req)
  if (!params) {
    respond(res, { status: 400, payload: { error: 'bad-request' } })
    return
  }
  respond(res, await resolveCover(params))
}

export async function handleImageApi(req, res) {
  if (!methodAllowed(req)) {
    respond(res, { status: 405, payload: { error: 'method-not-allowed' } })
    return
  }
  const params = searchParamsOf(req)
  if (!params) {
    respond(res, { status: 400, payload: { error: 'bad-request' } })
    return
  }
  respond(res, await resolveImage(params))
}

/** Vite 中间件：接管 /api/covers 与 /api/cover-image，其他请求交回给 Vite */
export function coverApiMiddleware() {
  return (req, res, next) => {
    if (req.url?.startsWith('/api/cover-image')) {
      void handleImageApi(req, res)
      return
    }
    if (req.url?.startsWith('/api/covers')) {
      void handleCoverApi(req, res)
      return
    }
    next()
  }
}
