import { resolveCover } from '../../server/coverApi.mjs'
import { allowRequest, jsonResponse } from './_utils.js'

/** GET /api/covers?title=&author= —— 与本地 Node 服务共用 server/coverApi.mjs */
export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse(405, { error: 'method-not-allowed' })
  }
  if (!allowRequest(request)) {
    return jsonResponse(429, { error: 'too-many-requests' })
  }

  const { status, payload } = await resolveCover(new URL(request.url).searchParams)
  return jsonResponse(status, payload)
}
