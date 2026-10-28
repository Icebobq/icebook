/**
 * 中文书封面来源。
 *
 * 豆瓣、当当都没有 CORS 头，浏览器不能直接请求，所以这里跑在 Node 侧，
 * 由 /api/covers 统一转发：先按优先级查，再把封面图下载成 base64 一起返回。
 * 只依赖 Node 内置能力，不需要额外装包。
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const TIMEOUT_MS = 6000
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 只允许从这些域名下载封面图，避免代理被当成任意 URL 的跳板 */
const IMAGE_HOSTS = [
  'doubanio.com',
  'ddimg.cn',
  'books.google.com',
  'books.googleusercontent.com',
  'covers.openlibrary.org',
]

async function request(url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'user-agent': UA, ...(init.headers ?? {}) },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(url) {
  try {
    const response = await request(url, { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

/** 归一化书名：去大小写、空白与标点 */
const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim()

/**
 * 去掉营销性后缀：`活着（余华代表作，精装定本）` → `活着`，
 * `【商务印书馆】新华学生字典` → `新华学生字典`。
 * 电商标题里常带括号 / 冒号，直接比对会永远对不上。
 */
const mainTitle = (value) =>
  String(value ?? '')
    .replace(/[【（([][^】）)\]]*[】）)\]]/g, ' ')
    .split(/[：:]/)[0]
    .replace(/\s+/g, ' ')
    .trim()

function sameBook(candidate, title) {
  const a = normalize(mainTitle(title))
  const b = normalize(mainTitle(candidate))
  if (!a || !b) return false
  if (a === b) return true
  if (b.startsWith(a) && b.length - a.length <= 6) return true
  if (a.startsWith(b) && a.length - b.length <= 6) return true
  return false
}

function authorMatches(authors, author) {
  const target = normalize(author)
  if (!target || !Array.isArray(authors)) return false
  return authors.some((name) => {
    const b = normalize(name)
    return b.length > 1 && (b.includes(target) || target.includes(b))
  })
}

/**
 * 通用挑选：先要“书名 + 作者”都对上，退一步只认完全一致的书名。
 * 宁可返回 null 让界面回落到合成书脊，也不贴错封面。
 */
function pickBest(items, { title, author, authorsOf, coverOf }) {
  const strict = (item) => sameBook(item._title, title)
  for (const item of items) {
    if (!strict(item)) continue
    if (!authorMatches(authorsOf(item), author)) continue
    const cover = coverOf(item)
    if (cover) return cover
  }
  for (const item of items) {
    if (normalize(mainTitle(item._title)) !== normalize(mainTitle(title))) continue
    const cover = coverOf(item)
    if (cover) return cover
  }
  return null
}

const decodeEntities = (raw) =>
  raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

/** 豆瓣：标题建议接口最快，中文书覆盖也最好 */
async function fromDouban({ title, author }) {
  const list = await getJson(`https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`)
  if (!Array.isArray(list)) return null

  const items = list
    .filter((item) => item && typeof item === 'object' && typeof item.pic === 'string' && item.pic)
    .map((item) => ({ ...item, _title: item.title }))

  return pickBest(items, {
    title,
    author,
    authorsOf: (item) => [item.author_name],
    // 缩略图换成大图：/view/subject/s/public/ → /view/subject/l/public/
    coverOf: (item) => ({
      coverUrl: item.pic.replace('/view/subject/s/public/', '/view/subject/l/public/'),
      source: 'douban',
    }),
  })
}

/** 当当搜索结果里的封面地址通常是 //img3m8.ddimg.cn/...，补全协议并把小图换成大图 */
function dangdangCover(src) {
  const abs = src.startsWith('//') ? `https:${src}` : src.replace(/^http:/, 'https:')
  return abs.replace(/-1_[a-z]_\d+\.jpg/i, (m) => (m.includes('_b_') ? m : m.replace(/_[a-z]_/, '_b_')))
}

function parseDangdang(html) {
  const items = []
  const chunks = html.split(/<li[\s>]/i).slice(1)
  for (const chunk of chunks) {
    const img = chunk.match(
      /<img[^>]+(?:data-original|src)=["']([^"']*ddimg\.cn[^"']*)["']/i,
    )
    const anchor = chunk.match(/<a[^>]+title=["']([^"']+)["']/i)
    if (!img || !anchor) continue

    const authorBlock = chunk.match(/<p class=["']search_book_author["']>([\s\S]*?)<\/p>/i)
    const authors = authorBlock
      ? [...authorBlock[1].matchAll(/<a[^>]*>([^<]{1,20})<\/a>/g)].map((m) =>
          decodeEntities(m[1]).trim().replace(/[，,、]\s*$/, ''),
        )
      : []

    items.push({
      _title: decodeEntities(anchor[1]).trim(),
      _cover: dangdangCover(img[1]),
      _authors: authors,
    })
    if (items.length >= 12) break
  }
  return items
}

/** 当当：页面是 GB2312 编码，用 gb18030 解码；搜索词本身用 UTF-8 就够 */
async function fromDangdang({ title, author }) {
  let html = ''
  try {
    const response = await request(
      `https://search.dangdang.com/?key=${encodeURIComponent(title)}&act=input`,
      { headers: { accept: 'text/html' } },
    )
    if (!response.ok) return null
    html = new TextDecoder('gb18030').decode(await response.arrayBuffer())
  } catch {
    return null
  }

  return pickBest(parseDangdang(html), {
    title,
    author,
    authorsOf: (item) => item._authors,
    coverOf: (item) => ({ coverUrl: item._cover, source: 'dangdang' }),
  })
}

async function fromGoogleBooks({ title, author }) {
  const query = [`intitle:"${title}"`, author && `inauthor:"${author}"`].filter(Boolean).join(' ')
  const data = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&country=US`,
  )
  if (!data || !Array.isArray(data.items)) return null

  const items = data.items
    .filter((item) => item && item.volumeInfo && item.volumeInfo.imageLinks?.thumbnail)
    .map((item) => ({
      _title: item.volumeInfo.title,
      _authors: item.volumeInfo.authors,
      _cover: String(item.volumeInfo.imageLinks.thumbnail),
      _isbn: (item.volumeInfo.industryIdentifiers ?? []).find(
        (id) => id && id.type === 'ISBN_13' && typeof id.identifier === 'string',
      )?.identifier,
    }))

  return pickBest(items, {
    title,
    author,
    authorsOf: (item) => item._authors,
    coverOf: (item) => ({
      coverUrl: item._cover
        .replace(/^http:\/\//, 'https://')
        .replace(/&edge=curl/g, '')
        .replace(/&zoom=\d+/g, '&zoom=1'),
      source: 'google',
      isbn: item._isbn,
    }),
  })
}

async function fromOpenLibrary({ title, author }) {
  const data = await getJson(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=10&fields=cover_i,isbn,title,author_name`,
  )
  if (!data || !Array.isArray(data.docs)) return null

  const items = data.docs
    .filter((doc) => doc && typeof doc.cover_i === 'number' && doc.cover_i > 0)
    .map((doc) => ({
      _title: doc.title,
      _authors: doc.author_name,
      _cover: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
      _isbn: (doc.isbn ?? []).find((v) => typeof v === 'string' && /^97[89]\d{10}$/.test(v)),
    }))

  return pickBest(items, {
    title,
    author,
    authorsOf: (item) => item._authors,
    coverOf: (item) => ({ coverUrl: item._cover, source: 'openlibrary', isbn: item._isbn }),
  })
}

/**
 * 查封面。豆瓣命中率最高所以先单独问，失败再并行问其余三家。
 * 全部失败返回 null。
 */
export async function searchCover({ title, author = '' }) {
  const douban = await fromDouban({ title, author })
  if (douban) return douban

  const settled = await Promise.allSettled([
    fromDangdang({ title, author }),
    fromGoogleBooks({ title, author }),
    fromOpenLibrary({ title, author }),
  ])
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value) return result.value
  }
  return null
}

/** 字节转 base64：不依赖 Node 的 Buffer，Workers 与 Node 都能跑 */
function toBase64(bytes) {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** 下载封面图，返回 base64；域名不在白名单、不是图片或太大时返回 null */
export async function fetchImage(url) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }
  if (!IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    return null
  }

  try {
    // 豆瓣图床对无 Referer 的请求返回 418，带上来源页即可
    const referer = host.endsWith('doubanio.com')
      ? 'https://book.douban.com/'
      : host.endsWith('ddimg.cn')
        ? 'https://search.dangdang.com/'
        : undefined

    const response = await request(url, {
      headers: { accept: 'image/*', ...(referer ? { referer } : {}) },
    })
    if (!response.ok) return null
    const type = (response.headers.get('content-type') ?? '').toLowerCase()
    if (!type.startsWith('image/')) return null

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null

    return { mime: type.split(';')[0], data: toBase64(bytes) }
  } catch {
    return null
  }
}
