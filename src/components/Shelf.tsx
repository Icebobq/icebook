import type { Book, Category } from '../data/library'
import { useI18n } from '../i18n'
import { BookSpine } from './BookSpine'

export function Shelf({
  category,
  books,
  onBookLongPress,
}: {
  category: Category
  books: Book[]
  onBookLongPress?: (book: Book) => void
}) {
  const { t, categoryName } = useI18n()

  return (
    <section className="flex h-full min-w-0 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-[15px] tracking-[0.02em] text-ink sm:text-[17px]">
          {categoryName(category.id)}
        </h2>
        <span className="shrink-0 text-[11px] text-ink-3 tabular-nums">
          {t('common.volumeCount', { count: books.length })}
        </span>
      </div>

      {/* 书柜一层：没有柜体，只有一条细长层板；高度写死，多列并排时层板底边才能对齐 */}
      <div className="relative mt-auto">
        <div className="overflow-hidden rounded-t-[20px] bg-gradient-to-b from-transparent to-gold-soft/25">
          <div className="hide-scrollbar flex h-[216px] items-end gap-1 overflow-x-auto px-3 pt-7 sm:h-[246px] sm:gap-1.5 sm:px-5">
            {books.length === 0 ? (
              <div className="mb-0.5 flex w-full items-center justify-center self-stretch">
                <span className="text-xs tracking-wide text-ink-3">{t('shelf.layerEmpty')}</span>
              </div>
            ) : (
              books.map((book) => (
                <BookSpine key={book.id} book={book} onLongPress={onBookLongPress} />
              ))
            )}
            <div aria-hidden className="min-w-6 flex-1 shrink-0" style={{ height: 140 }} />
          </div>
        </div>

        {/* 细长层板 + 柔和投影 */}
        <div className="relative h-[9px] rounded-[2px] shelf-ledge" />
        <div aria-hidden className="mx-3 h-4 shelf-glow sm:mx-5" />
      </div>
    </section>
  )
}
