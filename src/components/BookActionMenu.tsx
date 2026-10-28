import { useEffect } from 'react'
import type { Book } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

export function BookActionMenu({
  book,
  onEdit,
  onDelete,
  onClose,
}: {
  book: Book | null
  onEdit: (book: Book) => void
  onDelete: (book: Book) => void
  onClose: () => void
}) {
  const { t, categoryName, statusLabel } = useI18n()
  const { coverSrc } = useLibrary()
  const open = Boolean(book)
  const cover = book ? coverSrc(book) : undefined

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!book) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 bg-[#2c1810]/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-action-title"
        className="relative w-full max-w-[420px] rounded-t-[26px] bg-surface p-5 pb-6 shadow-[0_-10px_50px_-10px_rgba(44,24,16,0.5)] sm:rounded-[26px] sm:p-6"
      >
        <div className="flex items-center gap-3">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-[52px] w-[38px] shrink-0 rounded-s-[2px] rounded-e-[3px] object-cover shadow-[1px_4px_10px_-4px_rgba(76,49,28,0.55)]"
            />
          ) : (
            <span
              aria-hidden
              className="h-11 w-2 shrink-0 rounded-s-[3px] rounded-e-[1px]"
              style={{
                backgroundImage: `linear-gradient(100deg, color-mix(in oklab, ${book.spineColor} 72%, #2c1810), ${book.spineColor} 45%, color-mix(in oklab, ${book.spineColor} 70%, #2c1810))`,
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="book-action-title" className="font-display truncate text-[16px] text-ink">
              {book.title}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-ink-3">
              {book.author} · {categoryName(book.categoryId)} · {statusLabel(book.status)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-paper-2"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={() => onEdit(book)}
            className="flex h-12 w-full items-center justify-between rounded-[16px] bg-paper px-4 text-sm text-ink transition-colors hover:bg-gold-soft/60"
          >
            <span>{t('menu.edit')}</span>
            <span aria-hidden className="text-ink-3">
              ↗
            </span>
          </button>
          <button
            onClick={() => onDelete(book)}
            className="flex h-12 w-full items-center justify-between rounded-[16px] bg-paper px-4 text-sm text-[#a4553f] transition-colors hover:bg-[#f4e0d8]"
          >
            <span>{t('menu.delete')}</span>
            <span aria-hidden className="text-[#c08a7c]">
              ✕
            </span>
          </button>
        </div>

        <p className="mt-3.5 text-center text-[10px] text-ink-3">{t('menu.hint')}</p>
      </div>
    </div>
  )
}
