export type CoverSource = 'douban' | 'dangdang' | 'google' | 'openlibrary' | 'manual'

export interface CoverImage {
  mime: string
  /** base64，落库前会转成 Blob */
  data: string
}

export interface CoverLookupResult {
  url: string
  source: Exclude<CoverSource, 'manual'>
  isbn?: string
  /** 服务端已下载好的封面图；拿不到时前端直接用 url 显示 */
  image?: CoverImage
}

/** 代理接口，开发与自托管时由 server/ 提供；纯静态托管时不存在 */
const PROXY_PATH = '/api/covers'
const PROXY_TIMEOUT_MS = 12000
const TIMEOUT_MS = 4000

/** Google Books 匿名配额耗尽（429/403）后，本次会话内不再重试，省下每本书的等待 */
let googleDisabled = false

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 带超时的 JSON GET，任何失败（网络、超时、非 2xx）都返回 null，让调用方回落 */
async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (response.status === 429 || response.status === 403) googleDisabled = true
    if (!response.ok) return null
    return (await response.json()) as unknown
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/** 归一化书名：去大小写、空白与标点，便于和检索结果比对 */
const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim()

/** 去掉营销性后缀：`活着（余华代表作，精装定本）` → `活着` */
const mainTitle = (value: string) =>
  value
    .replace(/[【（([][^】）)\]]*[】）)\]]/g, ' ')
    .split(/[：:]/)[0]
    .replace(/\s+/g, ' ')
    .trim()

/**
 * 判断检索结果是不是同一本书：主标题一致，或“主标题 + 几个字的副标题”。
 * 宁可判定失败（回落到合成书脊），也不要把无关书的封面贴上来。
 */
function sameBook(candidate: unknown, title: string): candidate is string {
  if (typeof candidate !== 'string') return false
  const a = normalizeTitle(mainTitle(title))
  const b = normalizeTitle(mainTitle(candidate))
  if (!a || !b) return false
  if (a === b) return true
  if (b.startsWith(a) && b.length - a.length <= 6) return true
  if (a.startsWith(b) && a.length - b.length <= 6) return true
  return false
}

/** 作者至少有一个名字出现在结果里，用于在多条结果中优先挑选 */
function authorMatches(authors: unknown, author: string): boolean {
  if (!author || !Array.isArray(authors)) return false
  const a = normalizeTitle(author)
  return authors.some((name) => {
    if (typeof name !== 'string') return false
    const b = normalizeTitle(name)
    return b.length > 1 && (b.includes(a) || a.includes(b))
  })
}

/**
 * 服务端代理：一次请求同时拿到来源、封面地址和图片数据。
 * 返回 undefined 表示代理不可用（纯静态托管），交给下面的直连兜底；
 * 返回 null 表示代理明确回复“没有这本书的封面”。
 */
async function fromProxy(
  title: string,
  author: string,
): Promise<CoverLookupResult | null | undefined> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const response = await fetch(
      `${PROXY_PATH}?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`,
      { signal: controller.signal },
    )
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
      return undefined
    }
    if (response.status === 404) return null
    if (!response.ok) return undefined

    const data: unknown = await response.json()
    if (!isRecord(data) || typeof data.coverUrl !== 'string') return undefined
    const source = data.source
    if (source !== 'douban' && source !== 'dangdang' && source !== 'google' && source !== 'openlibrary') {
      return undefined
    }

    const rawImage = isRecord(data.image) ? data.image : null
    const image =
      rawImage && typeof rawImage.mime === 'string' && typeof rawImage.data === 'string'
        ? { mime: rawImage.mime, data: rawImage.data }
        : undefined

    return {
      url: data.coverUrl,
      source,
      isbn: typeof data.isbn === 'string' ? data.isbn : undefined,
      image,
    }
  } catch {
    return undefined
  } finally {
    window.clearTimeout(timer)
  }
}

// 缩略图去掉翻页卷边、强制 https，尽量拿到干净的正封
const normalizeGoogleThumb = (raw: string) =>
  raw
    .replace(/^http:\/\//, 'https://')
    .replace(/&edge=curl/g, '')
    .replace(/&zoom=\d+/g, '&zoom=1')

async function fromGoogleBooks(title: string, author: string): Promise<CoverLookupResult | null> {
  if (googleDisabled) return null

  const query = [`intitle:"${title}"`, author && `inauthor:"${author}"`].filter(Boolean).join(' ')
  const data = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&country=US`,
  )
  if (!isRecord(data) || !Array.isArray(data.items)) return null

  const pick = (preferAuthor: boolean) => {
    for (const item of data.items as unknown[]) {
      if (!isRecord(item) || !isRecord(item.volumeInfo)) continue
      const info = item.volumeInfo
      if (!sameBook(info.title, title)) continue
      if (preferAuthor && !authorMatches(info.authors, author)) continue

      const links = isRecord(info.imageLinks) ? info.imageLinks : null
      const thumb = typeof links?.thumbnail === 'string' ? links.thumbnail : undefined
      if (!thumb) continue

      const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : []
      const isbn = identifiers.find(
        (id) => isRecord(id) && id.type === 'ISBN_13' && typeof id.identifier === 'string',
      )
      return {
        url: normalizeGoogleThumb(thumb),
        source: 'google' as const,
        isbn: isRecord(isbn) ? (isbn.identifier as string) : undefined,
      }
    }
    return null
  }

  // 先找书名与作者都对上的，再放宽到只看书名
  return pick(true) ?? pick(false)
}

async function fromOpenLibrary(
  title: string,
  author: string,
): Promise<CoverLookupResult | null> {
  const data = await getJson(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10&fields=cover_i,isbn,title,author_name`,
  )
  if (!isRecord(data) || !Array.isArray(data.docs)) return null

  const pick = (preferAuthor: boolean) => {
    for (const doc of data.docs as unknown[]) {
      if (!isRecord(doc)) continue
      if (!sameBook(doc.title, title)) continue
      if (preferAuthor && !authorMatches(doc.author_name, author)) continue

      const coverId = doc.cover_i
      if (typeof coverId !== 'number' || coverId <= 0) continue

      const isbns = Array.isArray(doc.isbn) ? doc.isbn : []
      const isbn = isbns.find((v) => typeof v === 'string' && /^97[89]\d{10}$/.test(v))
      return {
        url: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
        source: 'openlibrary' as const,
        isbn: typeof isbn === 'string' ? isbn : undefined,
      }
    }
    return null
  }

  return pick(true) ?? pick(false)
}

/**
 * 查封面：优先走本地代理（豆瓣 / 当当等中文源都在那边）。
 * 代理不可用时退回到浏览器直连 Google Books → Open Library。
 */
export async function lookupCover({
  title,
  author,
}: {
  title: string
  author?: string
}): Promise<CoverLookupResult | null> {
  const cleanTitle = title.trim()
  if (!cleanTitle) return null
  const cleanAuthor = (author ?? '').trim()

  const proxied = await fromProxy(cleanTitle, cleanAuthor)
  if (proxied !== undefined) return proxied

  const google = await fromGoogleBooks(cleanTitle, cleanAuthor)
  if (google) return google

  return fromOpenLibrary(cleanTitle, cleanAuthor)
}

/**
 * 只下载已经记下的封面外链，不重新检索。
 * 返回 undefined 表示代理不可用（纯静态托管）；返回 null 表示代理拒绝/下载失败。
 */
export async function downloadCoverImage(url: string): Promise<CoverImage | null | undefined> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
  try {
    const response = await fetch(`/api/cover-image?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    })
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) return undefined
    if (!response.ok) return null

    const data: unknown = await response.json()
    if (!isRecord(data) || !isRecord(data.image)) return null
    const image = data.image
    if (typeof image.mime !== 'string' || typeof image.data !== 'string') return null
    return { mime: image.mime, data: image.data }
  } catch {
    return undefined
  } finally {
    window.clearTimeout(timer)
  }
}

/** base64 → Blob，用于把代理下载好的封面存进 IndexedDB */
export function toBlob(image: CoverImage): Blob | null {
  try {
    const binary = atob(image.data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: image.mime })
  } catch {
    return null
  }
}
