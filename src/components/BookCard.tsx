import { Link } from 'react-router-dom'
import type { Book } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

const statusTone: Record<Book['status'], string> = {
  unread: 'bg-paper-3 text-ink-2',
  reading: 'bg-gold-soft text-gold-deep',
  finished: 'bg-[#e9dbc5] text-[#8a5c39]',
  paused: 'bg-paper-2 text-ink-3',
}

export function BookCard({ book }: { book: Book }) {
  const { t, categoryName, statusLabel } = useI18n()
  const { coverSrc } = useLibrary()
  const cover = coverSrc(book)
  const progress =
    book.pages > 0 ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : 0

  return (
    <Link
      to={`/books/${book.id}`}
      className="card-soft group flex items-stretch gap-3.5 rounded-[18px] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-20px_rgba(44,24,16,0.45)] sm:gap-4 sm:p-4"
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="h-[52px] w-[38px] shrink-0 self-center rounded-s-[2px] rounded-e-[3px] object-cover shadow-[1px_4px_10px_-4px_rgba(76,49,28,0.55)]"
        />
      ) : (
        <div
          className="w-2.5 shrink-0 rounded-s-[3px] rounded-e-[1px] transition-transform duration-300 group-hover:scale-y-[1.02]"
          style={{
            backgroundImage: `linear-gradient(100deg, color-mix(in oklab, ${book.spineColor} 72%, #2c1810), ${book.spineColor} 42%, color-mix(in oklab, ${book.spineColor} 68%, #2c1810))`,
          }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display truncate text-[15px] tracking-[0.01em] text-ink">
            {book.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] leading-4 ${statusTone[book.status]}`}
          >
            {statusLabel(book.status)}
          </span>
        </div>

        <p className="mt-1 truncate text-xs text-ink-2">
          {book.author} · {categoryName(book.categoryId)}
        </p>

        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-ink-2 tabular-nums">
          <span>¥{book.price}</span>
          <span className="text-ink-3">{book.purchasedAt}</span>
          <span className="text-ink-3">{t('shelf.cardReads', { count: book.readCount })}</span>
          <span className="hidden text-ink-3 sm:inline">
            {t('shelf.cardFinished', { count: book.finishCount })}
          </span>
        </div>

        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-paper-2">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
