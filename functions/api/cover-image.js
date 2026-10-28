import { resolveImage } from '../../server/coverApi.mjs'
import { allowRequest, jsonResponse } from './_utils.js'

/** GET /api/cover-image?url= —— 按外链下载已记录的封面，导入备份后回填用 */
export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse(405, { error: 'method-not-allowed' })
  }
  if (!allowRequest(request)) {
    return jsonResponse(429, { error: 'too-many-requests' })
  }

  const { status, payload } = await resolveImage(new URL(request.url).searchParams)
  return jsonResponse(status, payload)
}
