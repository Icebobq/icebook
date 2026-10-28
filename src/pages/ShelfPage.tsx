import { useMemo, useState } from 'react'
import { BookActionMenu } from '../components/BookActionMenu'
import { BookCard } from '../components/BookCard'
import { BookDialog } from '../components/BookDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DataMenu } from '../components/DataMenu'
import { Shelf } from '../components/Shelf'
import { categories, type Book } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

type ViewMode = 'shelf' | 'list'

const statusOrder = ['unread', 'reading', 'finished', 'paused'] as const

export function ShelfPage() {
  const { books, deleteBook } = useLibrary()
  const { t, lang, categoryName } = useI18n()
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [view, setView] = useState<ViewMode>('shelf')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [menuBook, setMenuBook] = useState<Book | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Book | null>(null)

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    return books.filter((b) => {
      const matchKeyword =
        !k || b.title.toLowerCase().includes(k) || b.author.toLowerCase().includes(k)
      const matchCategory = categoryFilter === 'all' || b.categoryId === categoryFilter
      return matchKeyword && matchCategory
    })
  }, [books, keyword, categoryFilter])

  const stats = useMemo(() => {
    const totalSpent = books.reduce((sum, b) => sum + b.price, 0)
    const finished = books.filter((b) => b.status === 'finished').length
    const reading = books.filter((b) => b.status === 'reading').length
    const totalReads = books.reduce((sum, b) => sum + b.readCount, 0)
    return { totalSpent, finished, reading, totalReads }
  }, [books])

  const grouped = categories
    .filter((c) => categoryFilter === 'all' || c.id === categoryFilter)
    .map((c) => ({ category: c, items: filtered.filter((b) => b.categoryId === c.id) }))
    .filter((g) => g.items.length > 0 || (!keyword && categoryFilter === 'all'))

  const categoryChips = [
    { id: 'all', name: t('shelf.all') },
    ...categories.map((c) => ({ id: c.id, name: categoryName(c.id) })),
  ]

  return (
    <div className="space-y-8">
      {/* 概览 */}
      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[30px] leading-[1.15] text-ink sm:text-[38px]">
              {t('shelf.title')}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DataMenu />
            <button
              onClick={() => setDialogOpen(true)}
              className="hidden h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-5 text-[13px] font-medium text-[#fdf6ea] shadow-[0_14px_26px_-16px_rgba(44,24,16,0.9)] transition hover:bg-[#3b241a] active:scale-[0.98] sm:flex"
            >
              <span aria-hidden className="text-base leading-none">
                ＋
              </span>
              {t('shelf.add')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t('shelf.statBooks')} value={`${books.length}`} unit={t('unit.volume')} />
          <Stat label={t('shelf.statFinished')} value={`${stats.finished}`} unit={t('unit.volume')} />
          <Stat label={t('shelf.statReading')} value={`${stats.reading}`} unit={t('unit.copy')} />
          <Stat label={t('shelf.statReads')} value={`${stats.totalReads}`} unit={t('unit.times')} />
        </div>

        <p className="-mt-2 text-[11px] tracking-[0.06em] text-ink-3 tabular-nums">
          {t('shelf.spent', {
            amount: `¥${stats.totalSpent.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}`,
          })}
        </p>
      </section>

      {/* 工具栏 */}
      <section className="space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <circle cx="7" cy="7" r="4.5" stroke="var(--color-ink-3)" strokeWidth="1.4" />
              <path
                d="M10.5 10.5L14 14"
                stroke="var(--color-ink-3)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('shelf.search')}
              aria-label={t('shelf.search')}
              className="h-11 w-full rounded-full bg-surface pr-4 pl-10.5 text-sm text-ink outline-none transition-shadow shadow-[0_8px_22px_-20px_rgba(44,24,16,0.7)] placeholder:text-ink-3 focus:shadow-[0_0_0_1.5px_var(--color-gold)]"
            />
          </div>

          <div
            role="group"
            aria-label={t('shelf.viewGroup')}
            className="flex h-11 shrink-0 items-center gap-1 rounded-full bg-surface p-1 shadow-[0_8px_22px_-20px_rgba(44,24,16,0.7)]"
          >
            {(['shelf', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                aria-label={mode === 'shelf' ? t('shelf.viewShelf') : t('shelf.viewList')}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs transition-colors sm:px-3.5 ${
                  view === mode ? 'bg-gold-soft font-medium text-ink' : 'text-ink-2'
                }`}
              >
                {mode === 'shelf' ? (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path
                      d="M3 4.5h3.5v11H3zM7.5 6.5H11v9H7.5z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path
                      d="M13.4 3.6l2.9.8-2.5 10.9-2.9-.7z"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <path d="M2 17h16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path
                      d="M3.5 5.5h13M3.5 10h13M3.5 14.5h9"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline">
                  {mode === 'shelf' ? t('shelf.viewShelf') : t('shelf.viewList')}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          role="group"
          aria-label={t('shelf.filterGroup')}
          className="hide-scrollbar fade-x -mx-4 flex gap-2 overflow-x-auto pl-4 pr-7 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {categoryChips.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              aria-pressed={categoryFilter === c.id}
              className={`h-8 shrink-0 rounded-full px-3.5 text-xs transition-colors ${
                categoryFilter === c.id
                  ? 'bg-gold font-medium text-ink shadow-[0_8px_18px_-12px_rgba(184,135,74,0.9)]'
                  : 'bg-surface text-ink-2 hover:bg-gold-soft/60 hover:text-ink'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* 内容 */}
      {books.length === 0 ? (
        <div className="card-soft rounded-[22px] px-6 py-16 text-center">
          <p className="font-display text-[15px] text-ink">{t('shelf.emptyTitle')}</p>
          <p className="mt-2 text-xs text-ink-3">{t('shelf.emptyBody')}</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-5 h-10 rounded-full bg-ink px-5 text-xs font-medium text-[#fdf6ea] transition hover:bg-[#3b241a]"
          >
            {t('shelf.emptyAction')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-soft rounded-[22px] px-6 py-16 text-center">
          <p className="font-display text-[15px] text-ink">{t('shelf.noMatchTitle')}</p>
          <p className="mt-2 text-xs text-ink-3">{t('shelf.noMatchBody')}</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-5 h-9 rounded-full border border-gold-deep/40 px-5 text-xs text-gold-deep transition-colors hover:bg-gold-soft/60"
          >
            {t('shelf.add')}
          </button>
        </div>
      ) : view === 'shelf' ? (
        <div className="space-y-3">
          <p className="text-right text-[11px] text-ink-3">{t('shelf.hint')}</p>
          <div className="grid gap-x-8 gap-y-9 lg:grid-cols-2">
            {grouped.map(({ category, items }) => (
              <Shelf
                key={category.id}
                category={category}
                books={items}
                onBookLongPress={setMenuBook}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[...filtered]
            .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
            .map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
        </div>
      )}

      {/* 移动端悬浮按钮 */}
      <button
        onClick={() => setDialogOpen(true)}
        aria-label={t('shelf.add')}
        className="fixed right-4 bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 grid place-items-center rounded-full bg-ink text-2xl leading-none text-[#fdf6ea] shadow-[0_16px_28px_-12px_rgba(44,24,16,0.8)] transition active:scale-95 sm:hidden"
        style={{ width: 52, height: 52 }}
      >
        ＋
      </button>

      <BookDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <BookDialog
        open={editingBook !== null}
        book={editingBook ?? undefined}
        onClose={() => setEditingBook(null)}
      />

      <BookActionMenu
        book={menuBook}
        onClose={() => setMenuBook(null)}
        onEdit={(book) => {
          setMenuBook(null)
          setEditingBook(book)
        }}
        onDelete={(book) => {
          setMenuBook(null)
          setPendingDelete(book)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('shelf.deleteTitle', { title: pendingDelete?.title ?? '' })}
        description={t('shelf.deleteBody')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteBook(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card-soft rounded-[18px] px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[10px] tracking-[0.14em] text-ink-3">{label}</p>
      <p className="font-display mt-1.5 text-[22px] leading-none text-ink tabular-nums sm:text-[26px]">
        {value}
        <span className="ml-1 font-sans-cn text-[10px] font-normal tracking-[0.06em] text-ink-3">
          {unit}
        </span>
      </p>
    </div>
  )
}
