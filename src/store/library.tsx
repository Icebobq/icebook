import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  books as seedBooks,
  notes as seedNotes,
  type Book,
  type Note,
} from '../data/library'
import { libraryRepository } from '../data/idbRepository'
import {
  SCHEMA_VERSION,
  parseSnapshot,
  type LibrarySnapshot,
} from '../data/repository'
import { downloadCoverImage, lookupCover, toBlob, type CoverImage } from '../data/covers'
import { useI18n } from '../i18n'

export interface NewBookInput {
  title: string
  author: string
  categoryId: string
  price: number
  purchasedAt: string
  pages: number
  coverUrl?: string
}

/** 编辑书籍时可改的字段 */
export type BookPatch = Partial<
  Pick<
    Book,
    | 'title'
    | 'author'
    | 'categoryId'
    | 'price'
    | 'purchasedAt'
    | 'pages'
    | 'currentPage'
    | 'status'
    | 'rating'
    | 'blurb'
    | 'coverUrl'
    | 'coverSource'
    | 'isbn'
    | 'coverCheckedAt'
  >
>

export interface NoteInput {
  type: Note['type']
  content: string
  pageNo?: number
  favorite: boolean
}

export type StorageState = 'loading' | 'ready' | 'error'

export interface CoverSyncState {
  running: boolean
  done: number
  total: number
  found: number
}

interface LibraryValue {
  books: Book[]
  notes: Note[]
  storage: StorageState
  storageError: string | null
  coverSync: CoverSyncState
  addBook: (input: NewBookInput) => string
  updateBook: (id: string, patch: BookPatch) => void
  deleteBook: (id: string) => void
  bumpRead: (id: string) => void
  markFinished: (id: string) => void
  addNote: (bookId: string, input: NoteInput) => string
  updateNote: (id: string, input: NoteInput) => void
  deleteNote: (id: string) => void
  toggleFavorite: (noteId: string) => void
  exportSnapshot: () => LibrarySnapshot
  importSnapshot: (raw: string) => Promise<{ books: number; notes: number }>
  clearLibrary: () => Promise<void>
  /** 批量向公开书库查询封面，失败的书记下日期后回落到合成书脊 */
  syncCovers: () => Promise<{ found: number; total: number }>
  /** 封面实际可用的地址：优先本地缓存的 Blob，其次原始外链 */
  coverSrc: (book: Book) => string | undefined
  /** 把抓到的封面图存进本地缓存，避免外链失效 */
  cacheCover: (bookId: string, image: CoverImage, meta?: { source?: string; url?: string }) => Promise<void>
}

const LibraryContext = createContext<LibraryValue | null>(null)

const spinePalette: Array<Pick<Book, 'spineColor' | 'spineInk'>> = [
  { spineColor: '#8c4b3b', spineInk: 'light' },
  { spineColor: '#3c4b5c', spineInk: 'light' },
  { spineColor: '#5b6b5c', spineInk: 'light' },
  { spineColor: '#a8823f', spineInk: 'dark' },
  { spineColor: '#6b4557', spineInk: 'light' },
  { spineColor: '#4a4a42', spineInk: 'light' },
]

const today = () => new Date().toISOString().slice(0, 10)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [books, setBooks] = useState<Book[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [storage, setStorage] = useState<StorageState>('loading')
  const [storageError, setStorageError] = useState<string | null>(null)
  const [coverSync, setCoverSync] = useState<CoverSyncState>({
    running: false,
    done: 0,
    total: 0,
    found: 0,
  })

  // 用 ref 保存最新数据，写操作在事件回调里直接算出下一份状态并落库
  const booksRef = useRef<Book[]>([])
  const notesRef = useRef<Note[]>([])
  const syncingRef = useRef(false)

  // 本地缓存的封面：key 是书 id，value 是 objectURL 与它对应的原始外链
  const coversRef = useRef(new Map<string, { objectUrl: string; url?: string }>())
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map())
  /** 封面代理是否可用：unknown = 还没试过，no = 没有代理（纯静态托管） */
  const [proxyState, setProxyState] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const proxyStateRef = useRef<'unknown' | 'yes' | 'no'>('unknown')

  const messageOf = useCallback(
    (error: unknown) => (error instanceof Error ? error.message : t('storage.unknownError')),
    [t],
  )

  const commitBooks = useCallback((next: Book[]) => {
    booksRef.current = next
    setBooks(next)
  }, [])

  const commitNotes = useCallback((next: Note[]) => {
    notesRef.current = next
    setNotes(next)
  }, [])

  const persist = useCallback(
    (task: Promise<unknown>) => {
      task.catch((error) => {
        setStorageError(t('storage.saveFailed', { message: messageOf(error) }))
      })
    },
    [messageOf, t],
  )

  const publishCovers = useCallback(() => {
    setCoverUrls(new Map([...coversRef.current].map(([id, entry]) => [id, entry.objectUrl])))
  }, [])

  const markProxy = useCallback((state: 'yes' | 'no') => {
    if (proxyStateRef.current === state) return
    proxyStateRef.current = state
    setProxyState(state)
  }, [])

  const revokeCover = useCallback(
    (id: string) => {
      const entry = coversRef.current.get(id)
      if (!entry) return
      URL.revokeObjectURL(entry.objectUrl)
      coversRef.current.delete(id)
      publishCovers()
    },
    [publishCovers],
  )

  const revokeAllCovers = useCallback(() => {
    for (const entry of coversRef.current.values()) URL.revokeObjectURL(entry.objectUrl)
    coversRef.current.clear()
    publishCovers()
  }, [publishCovers])

  const cacheCover = useCallback(
    async (bookId: string, image: CoverImage, meta?: { source?: string; url?: string }) => {
      const blob = toBlob(image)
      if (!blob) return
      revokeCover(bookId)
      coversRef.current.set(bookId, { objectUrl: URL.createObjectURL(blob), url: meta?.url })
      publishCovers()
      persist(
        libraryRepository.saveCover({
          id: bookId,
          blob,
          source: meta?.source,
          coverUrl: meta?.url,
          savedAt: today(),
        }),
      )
    },
    [persist, publishCovers, revokeCover],
  )

  /**
   * 补齐本地缺失的封面缓存。
   * 导入备份 / 启动时只有外链地址，豆瓣图床会拒绝浏览器直连（403），
   * 所以这里按原地址再下一次图存进 IndexedDB。
   */
  const backfillCovers = useCallback(
    async (targets: Book[]) => {
      // 已经确认没有代理，再试也是白打请求
      if (proxyStateRef.current === 'no') return

      const queue = targets.filter((book) => book.coverUrl && !coversRef.current.has(book.id))
      if (queue.length === 0) return

      const runOne = async () => {
        while (queue.length > 0) {
          const book = queue.shift()
          if (!book?.coverUrl) continue
          const image = await downloadCoverImage(book.coverUrl)
          if (image === undefined) {
            markProxy('no')
            queue.length = 0
            return
          }
          markProxy('yes')
          if (image) await cacheCover(book.id, image, { source: book.coverSource, url: book.coverUrl })
        }
      }
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, runOne))
    },
    [cacheCover, markProxy],
  )

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        await libraryRepository.ready()
        const [storedBooks, storedNotes, storedCovers] = await Promise.all([
          libraryRepository.listBooks(),
          libraryRepository.listNotes(),
          libraryRepository.listCovers(),
        ])
        if (!alive) return
        commitBooks(storedBooks)
        commitNotes(storedNotes)
        coversRef.current = new Map(
          storedCovers.map((cover) => [
            cover.id,
            { objectUrl: URL.createObjectURL(cover.blob), url: cover.coverUrl },
          ]),
        )
        publishCovers()
        setStorage('ready')
        void backfillCovers(storedBooks)
      } catch (error) {
        if (!alive) return
        // 本地库不可用（如隐私模式）时退回种子数据，页面仍可浏览，但提示无法保存
        commitBooks(seedBooks)
        commitNotes(seedNotes)
        setStorage('error')
        setStorageError(t('storage.unavailable', { message: messageOf(error) }))
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [backfillCovers, commitBooks, commitNotes, messageOf, publishCovers, t])

  const addBook = useCallback(
    (input: NewBookInput) => {
      const id = `b${Date.now()}`
      const tone = spinePalette[Math.floor(Math.random() * spinePalette.length)]
      const book: Book = {
        id,
        title: input.title.trim(),
        author: input.author.trim() || '佚名',
        categoryId: input.categoryId,
        ...tone,
        thickness: input.pages > 500 ? 3 : input.pages > 250 ? 2 : 1,
        price: input.price,
        purchasedAt: input.purchasedAt || today(),
        readCount: 0,
        finishCount: 0,
        pages: input.pages,
        currentPage: 0,
        status: 'unread',
        rating: 0,
        blurb: '',
        coverUrl: input.coverUrl?.trim() || undefined,
        coverSource: input.coverUrl?.trim() ? 'manual' : undefined,
      }
      commitBooks([...booksRef.current, book])
      persist(libraryRepository.saveBook(book))
      return id
    },
    [commitBooks, persist],
  )

  const updateBook = useCallback(
    (id: string, patch: BookPatch) => {
      const current = booksRef.current.find((b) => b.id === id)
      if (!current) return
      const next: Book = { ...current, ...patch, title: (patch.title ?? current.title).trim() || current.title }
      commitBooks(booksRef.current.map((b) => (b.id === id ? next : b)))
      persist(libraryRepository.saveBook(next))

      // 手动换了封面地址：旧缓存不再对应当前这本书，清掉
      if (patch.coverUrl !== undefined && coversRef.current.get(id)?.url !== patch.coverUrl) {
        revokeCover(id)
        persist(libraryRepository.removeCover(id))
      }
    },
    [commitBooks, persist, revokeCover],
  )

  const deleteBook = useCallback(
    (id: string) => {
      commitBooks(booksRef.current.filter((b) => b.id !== id))
      commitNotes(notesRef.current.filter((n) => n.bookId !== id))
      revokeCover(id)
      persist(libraryRepository.removeBook(id))
    },
    [commitBooks, commitNotes, persist, revokeCover],
  )

  const bumpRead = useCallback(
    (id: string) => {
      const current = booksRef.current.find((b) => b.id === id)
      if (!current) return
      const next: Book = {
        ...current,
        readCount: current.readCount + 1,
        status: current.status === 'unread' ? 'reading' : current.status,
        currentPage:
          current.status === 'unread' && current.pages > 0
            ? Math.min(1, current.pages)
            : current.currentPage,
      }
      commitBooks(booksRef.current.map((b) => (b.id === id ? next : b)))
      persist(libraryRepository.saveBook(next))
    },
    [commitBooks, persist],
  )

  const markFinished = useCallback(
    (id: string) => {
      const current = booksRef.current.find((b) => b.id === id)
      if (!current) return
      const next: Book = {
        ...current,
        finishCount: current.finishCount + 1,
        readCount: current.readCount + (current.status === 'finished' ? 0 : 1),
        currentPage: current.pages,
        status: 'finished',
      }
      commitBooks(booksRef.current.map((b) => (b.id === id ? next : b)))
      persist(libraryRepository.saveBook(next))
    },
    [commitBooks, persist],
  )

  const addNote = useCallback(
    (bookId: string, input: NoteInput) => {
      const note: Note = {
        id: `n${Date.now()}`,
        bookId,
        type: input.type,
        content: input.content.trim(),
        pageNo: input.pageNo,
        createdAt: today(),
        favorite: input.favorite,
      }
      commitNotes([...notesRef.current, note])
      persist(libraryRepository.saveNote(note))
      return note.id
    },
    [commitNotes, persist],
  )

  const updateNote = useCallback(
    (id: string, input: NoteInput) => {
      const current = notesRef.current.find((n) => n.id === id)
      if (!current) return
      const next: Note = {
        ...current,
        type: input.type,
        content: input.content.trim(),
        pageNo: input.pageNo,
        favorite: input.favorite,
      }
      commitNotes(notesRef.current.map((n) => (n.id === id ? next : n)))
      persist(libraryRepository.saveNote(next))
    },
    [commitNotes, persist],
  )

  const deleteNote = useCallback(
    (id: string) => {
      commitNotes(notesRef.current.filter((n) => n.id !== id))
      persist(libraryRepository.removeNote(id))
    },
    [commitNotes, persist],
  )

  const toggleFavorite = useCallback(
    (noteId: string) => {
      const current = notesRef.current.find((n) => n.id === noteId)
      if (!current) return
      const next: Note = { ...current, favorite: !current.favorite }
      commitNotes(notesRef.current.map((n) => (n.id === noteId ? next : n)))
      persist(libraryRepository.saveNote(next))
    },
    [commitNotes, persist],
  )

  const exportSnapshot = useCallback(
    (): LibrarySnapshot => ({
      app: 'icebook',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      books: booksRef.current,
      notes: notesRef.current,
    }),
    [],
  )

  const importSnapshot = useCallback(
    async (raw: string) => {
      const { books: nextBooks, notes: nextNotes } = parseSnapshot(raw)
      await libraryRepository.replaceAll({ books: nextBooks, notes: nextNotes })
      revokeAllCovers()
      commitBooks(nextBooks)
      commitNotes(nextNotes)
      void backfillCovers(nextBooks)
      return { books: nextBooks.length, notes: nextNotes.length }
    },
    [backfillCovers, commitBooks, commitNotes, revokeAllCovers],
  )

  const clearLibrary = useCallback(async () => {
    await libraryRepository.clearAll()
    revokeAllCovers()
    commitBooks([])
    commitNotes([])
  }, [commitBooks, commitNotes, revokeAllCovers])

  const syncCovers = useCallback(async () => {
    if (syncingRef.current) return { found: 0, total: 0 }

    const targets = booksRef.current.filter((b) => !b.coverUrl && !b.coverCheckedAt)
    if (targets.length === 0) {
      setCoverSync({ running: false, done: 0, total: 0, found: 0 })
      return { found: 0, total: 0 }
    }

    syncingRef.current = true
    const total = targets.length
    const queue = [...targets]
    let done = 0
    let found = 0
    setCoverSync({ running: true, done: 0, total, found: 0 })

    const runOne = async () => {
      while (queue.length > 0) {
        const book = queue.shift()
        if (!book) break
        const hit = await lookupCover(book)
        const checkedAt = today()
        // 先把图存到本地，再写书；顺序反了会被 updateBook 当成“换了封面”清掉缓存
        if (hit?.image) {
          await cacheCover(book.id, hit.image, { source: hit.source, url: hit.url })
        }
        updateBook(
          book.id,
          hit
            ? {
                coverUrl: hit.url,
                coverSource: hit.source,
                isbn: hit.isbn,
                coverCheckedAt: checkedAt,
              }
            : { coverCheckedAt: checkedAt },
        )
        done += 1
        if (hit) found += 1
        setCoverSync({ running: true, done, total, found })
      }
    }

    try {
      // 并发 3 路，避免一次性把接口打满
      await Promise.all(Array.from({ length: Math.min(3, total) }, runOne))
    } finally {
      syncingRef.current = false
      setCoverSync({ running: false, done, total, found })
    }

    return { found, total }
  }, [cacheCover, updateBook])

  const coverSrc = useCallback(
    (book: Book) => {
      const cached = coverUrls.get(book.id)
      if (cached) return cached
      if (!book.coverUrl) return undefined
      // 豆瓣 / 当当的图会拒绝浏览器直连（403），缓存还没到位时先留白
      const needsProxy =
        book.coverSource === 'douban' ||
        book.coverSource === 'dangdang' ||
        /doubanio\.com|ddimg\.cn/.test(book.coverUrl)
      if (needsProxy && proxyState !== 'no') return undefined
      return book.coverUrl
    },
    [coverUrls, proxyState],
  )

  const value = useMemo(
    () => ({
      books,
      notes,
      storage,
      storageError,
      coverSync,
      addBook,
      updateBook,
      deleteBook,
      bumpRead,
      markFinished,
      addNote,
      updateNote,
      deleteNote,
      toggleFavorite,
      exportSnapshot,
      importSnapshot,
      clearLibrary,
      syncCovers,
      coverSrc,
      cacheCover,
    }),
    [
      books,
      notes,
      storage,
      storageError,
      coverSync,
      addBook,
      updateBook,
      deleteBook,
      bumpRead,
      markFinished,
      addNote,
      updateNote,
      deleteNote,
      toggleFavorite,
      exportSnapshot,
      importSnapshot,
      clearLibrary,
      syncCovers,
      coverSrc,
      cacheCover,
    ],
  )

  if (storage === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="text-center">
          <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="font-display mt-4 text-sm tracking-[0.08em] text-ink-2">
            {t('storage.loading')}
          </p>
        </div>
      </div>
    )
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary 必须在 LibraryProvider 内使用')
  return ctx
}
