import type { Book, Note } from './library'

/**
 * 数据层契约。
 *
 * 现在只有一个 IndexedDB 实现（src/data/idbRepository.ts），
 * 以后要换成服务器 / SQLite / Supabase 时，只需要新增一个实现，
 * 再替换 idbRepository.ts 里导出的 libraryRepository 单例即可，
 * 页面与 store 都不用改。
 */
export interface LibraryRepository {
  /** 打开连接、执行一次性的种子数据迁移 */
  ready(): Promise<void>
  listBooks(): Promise<Book[]>
  listNotes(): Promise<Note[]>
  saveBook(book: Book): Promise<void>
  /** 删除书籍时同步删掉它的笔记与封面缓存 */
  removeBook(id: string): Promise<void>
  saveNote(note: Note): Promise<void>
  removeNote(id: string): Promise<void>
  /** 已下载到本地的封面图，按书记 id 存 */
  listCovers(): Promise<CachedCover[]>
  saveCover(cover: CachedCover): Promise<void>
  removeCover(id: string): Promise<void>
  /** 用整份快照覆盖本地数据（导入 / 恢复备份），封面缓存一并清空 */
  replaceAll(data: { books: Book[]; notes: Note[] }): Promise<void>
  /** 清空书籍与笔记，但保留“已初始化”标记，避免重新灌入种子数据 */
  clearAll(): Promise<void>
}

/** 封面图缓存：外链（豆瓣 / 当当）随时可能失效或被防盗链拦下，存本地最稳 */
export interface CachedCover {
  id: string
  blob: Blob
  source?: string
  /** 这张图对应的原始外链，用来判断书的封面是否被换过 */
  coverUrl?: string
  savedAt: string
}

export const SCHEMA_VERSION = 2

export interface LibrarySnapshot {
  app: 'icebook'
  schemaVersion: number
  exportedAt: string
  books: Book[]
  notes: Note[]
}

const today = () => new Date().toISOString().slice(0, 10)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const str = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const num = (value: unknown, fallback = 0) => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

const clampInt = (value: unknown, min: number, max?: number) => {
  const n = Math.round(num(value, min))
  const upper = max == null ? n : Math.min(n, max)
  return Math.max(min, upper)
}

function normalizeBook(value: unknown, index: number): Book | null {
  if (!isRecord(value)) return null
  const title = str(value.title).trim()
  if (!title) return null

  const status = value.status
  const thickness = clampInt(value.thickness, 1, 3)
  const rawCover = str(value.coverUrl).trim()
  const coverSource = value.coverSource

  return {
    id: str(value.id) || `book-import-${index}`,
    title,
    author: str(value.author, '佚名').trim() || '佚名',
    categoryId: str(value.categoryId, 'literature'),
    spineColor: str(value.spineColor, '#8c4b3b'),
    spineInk: value.spineInk === 'dark' ? 'dark' : 'light',
    thickness: (thickness >= 3 ? 3 : thickness <= 1 ? 1 : 2) as Book['thickness'],
    price: Math.max(0, num(value.price)),
    purchasedAt: str(value.purchasedAt).slice(0, 10) || today(),
    readCount: clampInt(value.readCount, 0),
    finishCount: clampInt(value.finishCount, 0),
    pages: clampInt(value.pages, 0),
    currentPage: clampInt(value.currentPage, 0),
    status:
      status === 'reading' || status === 'finished' || status === 'paused' ? status : 'unread',
    rating: clampInt(value.rating, 0, 5),
    blurb: str(value.blurb),
    coverUrl: /^https?:\/\//i.test(rawCover) ? rawCover : undefined,
    coverSource:
      coverSource === 'douban' ||
      coverSource === 'dangdang' ||
      coverSource === 'google' ||
      coverSource === 'openlibrary' ||
      coverSource === 'manual'
        ? coverSource
        : undefined,
    isbn: str(value.isbn).trim() || undefined,
    coverCheckedAt: str(value.coverCheckedAt).slice(0, 10) || undefined,
  }
}

function normalizeNote(value: unknown, index: number): Note | null {
  if (!isRecord(value)) return null
  const content = str(value.content).trim()
  const bookId = str(value.bookId)
  if (!content || !bookId) return null

  const type = value.type
  const pageNo = num(value.pageNo, Number.NaN)

  return {
    id: str(value.id) || `note-import-${index}`,
    bookId,
    type: type === 'quote' || type === 'review' || type === 'note' ? type : 'note',
    content,
    pageNo: Number.isFinite(pageNo) ? Math.max(1, Math.round(pageNo)) : undefined,
    createdAt: str(value.createdAt).slice(0, 10) || today(),
    favorite: value.favorite === true,
  }
}

/** 解析备份文件，字段缺失或类型不对时尽量修正，完全无法识别时抛出可读错误 */
export function parseSnapshot(raw: string): { books: Book[]; notes: Note[] } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('文件不是合法的 JSON')
  }
  if (!isRecord(data)) throw new Error('JSON 顶层必须是一个对象')

  const rawBooks = data.books
  const rawNotes = data.notes
  if (!Array.isArray(rawBooks) && !Array.isArray(rawNotes)) {
    throw new Error('JSON 里没有 books / notes 字段，不像是 Icebook 的备份')
  }

  const books = (Array.isArray(rawBooks) ? rawBooks : [])
    .map(normalizeBook)
    .filter((b): b is Book => b !== null)
  const notes = (Array.isArray(rawNotes) ? rawNotes : [])
    .map(normalizeNote)
    .filter((n): n is Note => n !== null)

  return { books, notes }
}
