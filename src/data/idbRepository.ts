import { books as seedBooks, notes as seedNotes } from './library'
import type { Book, Note } from './library'
import type { CachedCover, LibraryRepository } from './repository'

/**
 * IndexedDB 版本的仓储实现。
 * 想换成服务器 / SQLite 后端时：在 src/data 下再写一个实现，
 * 然后把本文件底部的 libraryRepository 换成新的即可。
 */

const DB_NAME = 'icebook'
/** v2：新增 covers store，用来缓存下载回来的封面图 */
const DB_VERSION = 2

const STORE_BOOKS = 'books'
const STORE_NOTES = 'notes'
const STORE_META = 'meta'
const STORE_COVERS = 'covers'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        const notes = db.createObjectStore(STORE_NOTES, { keyPath: 'id' })
        notes.createIndex('bookId', 'bookId')
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_COVERS)) {
        db.createObjectStore(STORE_COVERS, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开本地数据库'))
    request.onblocked = () => reject(new Error('本地数据库被其他标签页占用，请关闭后重试'))
  })

  return dbPromise
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('数据库请求失败'))
  })
}

function drainCursor(request: IDBRequest<IDBCursorWithValue | null>): Promise<void> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve()
        return
      }
      cursor.delete()
      cursor.continue()
    }
    request.onerror = () => reject(request.error ?? new Error('数据库游标失败'))
  })
}

/** 在一个事务里执行操作，并等事务真正提交后再返回 */
async function withStores<T>(
  names: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase()
  const tx = db.transaction(names, mode)
  const result = await run(tx)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('数据库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('数据库事务被中止'))
  })
  return result
}

function createIndexedDbRepository(): LibraryRepository {
  let readyPromise: Promise<void> | null = null

  const seedIfNeeded = async () => {
    const seeded = await withStores([STORE_META], 'readonly', (tx) =>
      asPromise(tx.objectStore(STORE_META).get('seeded')),
    )
    if (seeded) return

    await withStores([STORE_BOOKS, STORE_NOTES, STORE_META], 'readwrite', async (tx) => {
      const books = tx.objectStore(STORE_BOOKS)
      const notes = tx.objectStore(STORE_NOTES)
      for (const book of seedBooks) books.put(book)
      for (const note of seedNotes) notes.put(note)
      tx.objectStore(STORE_META).put({ key: 'seeded', value: true })
    })
  }

  const ready = () => {
    if (!readyPromise) readyPromise = seedIfNeeded()
    return readyPromise
  }

  return {
    ready,

    async listBooks() {
      await ready()
      return withStores([STORE_BOOKS], 'readonly', (tx) =>
        asPromise<Book[]>(tx.objectStore(STORE_BOOKS).getAll()),
      )
    },

    async listNotes() {
      await ready()
      return withStores([STORE_NOTES], 'readonly', (tx) =>
        asPromise<Note[]>(tx.objectStore(STORE_NOTES).getAll()),
      )
    },

    async saveBook(book) {
      await withStores([STORE_BOOKS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_BOOKS).put(book)
      })
    },

    async removeBook(id) {
      await withStores([STORE_BOOKS, STORE_NOTES, STORE_COVERS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_BOOKS).delete(id)
        tx.objectStore(STORE_COVERS).delete(id)
        const index = tx.objectStore(STORE_NOTES).index('bookId')
        await drainCursor(index.openCursor(IDBKeyRange.only(id)))
      })
    },

    async saveNote(note) {
      await withStores([STORE_NOTES], 'readwrite', async (tx) => {
        tx.objectStore(STORE_NOTES).put(note)
      })
    },

    async removeNote(id) {
      await withStores([STORE_NOTES], 'readwrite', async (tx) => {
        tx.objectStore(STORE_NOTES).delete(id)
      })
    },

    async listCovers() {
      await ready()
      return withStores([STORE_COVERS], 'readonly', (tx) =>
        asPromise<CachedCover[]>(tx.objectStore(STORE_COVERS).getAll()),
      )
    },

    async saveCover(cover) {
      await withStores([STORE_COVERS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_COVERS).put(cover)
      })
    },

    async removeCover(id) {
      await withStores([STORE_COVERS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_COVERS).delete(id)
      })
    },

    async replaceAll({ books, notes }) {
      await withStores([STORE_BOOKS, STORE_NOTES, STORE_META, STORE_COVERS], 'readwrite', async (tx) => {
        const bookStore = tx.objectStore(STORE_BOOKS)
        const noteStore = tx.objectStore(STORE_NOTES)
        bookStore.clear()
        noteStore.clear()
        tx.objectStore(STORE_COVERS).clear()
        for (const book of books) bookStore.put(book)
        for (const note of notes) noteStore.put(note)
        tx.objectStore(STORE_META).put({ key: 'seeded', value: true })
      })
    },

    async clearAll() {
      await withStores([STORE_BOOKS, STORE_NOTES, STORE_META, STORE_COVERS], 'readwrite', async (tx) => {
        tx.objectStore(STORE_BOOKS).clear()
        tx.objectStore(STORE_NOTES).clear()
        tx.objectStore(STORE_COVERS).clear()
        tx.objectStore(STORE_META).put({ key: 'seeded', value: true })
      })
    },
  }
}

export const libraryRepository: LibraryRepository = createIndexedDbRepository()
