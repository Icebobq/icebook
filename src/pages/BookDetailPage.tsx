import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookDialog } from '../components/BookDialog'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteCard } from '../components/NoteCard'
import { NoteDialog } from '../components/NoteDialog'
import type { Book, Note } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

export function BookDetailPage() {
  const { id } = useParams()
  const { books, notes, deleteNote } = useLibrary()
  const { t, categoryName, statusLabel } = useI18n()
  const [editingBook, setEditingBook] = useState(false)
  const [noteEditor, setNoteEditor] = useState<{ type: Note['type']; note?: Note } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  const book = books.find((b) => b.id === id)

  if (!book) {
    return (
      <div className="py-24 text-center">
        <p className="font-display text-sm text-ink-2">{t('detail.missing')}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-xs text-gold-deep underline underline-offset-4"
        >
          {t('detail.backLink')}
        </Link>
      </div>
    )
  }

  const progress =
    book.pages > 0 ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : 0
  const bookNotes = notes
    .filter((n) => n.bookId === book.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const reviews = bookNotes.filter((n) => n.type === 'review')
  const quotes = bookNotes.filter((n) => n.type === 'quote')
  const others = bookNotes.filter((n) => n.type === 'note')

  return (
    <div className="mx-auto max-w-3xl space-y-8 sm:space-y-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-ink-2 transition-colors hover:text-ink"
      >
        <span aria-hidden>←</span>
        {t('detail.back')}
      </Link>

      <div className="flex gap-4 sm:gap-8">
        <BookCover book={book} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-[10px] text-gold-deep">
              {categoryName(book.categoryId)}
            </span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] text-ink-2 shadow-[0_6px_16px_-14px_rgba(44,24,16,0.6)]">
              {statusLabel(book.status)}
            </span>
            {book.rating > 0 && (
              <span
                className="text-[11px] tracking-[0.2em] text-gold-deep"
                aria-label={t('detail.ratingAria', { count: book.rating })}
              >
                {'★'.repeat(book.rating)}
                <span className="text-line">{'★'.repeat(5 - book.rating)}</span>
              </span>
            )}
          </div>

          <h1 className="font-display mt-2.5 text-[24px] leading-snug text-ink sm:text-[32px]">
            {book.title}
          </h1>
          <p className="mt-1.5 text-xs text-ink-2 sm:text-sm">{book.author}</p>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 sm:mt-7 sm:grid-cols-4">
            <Meta label={t('detail.metaPrice')} value={`¥${book.price}`} />
            <Meta label={t('detail.metaPurchasedAt')} value={book.purchasedAt} />
            <Meta
              label={t('detail.metaReads')}
              value={t('common.timesCount', { count: book.readCount })}
            />
            <Meta
              label={t('detail.metaFinishes')}
              value={t('common.timesCount', { count: book.finishCount })}
            />
          </div>

          {book.pages > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-end text-[11px] text-ink-2 tabular-nums">
                <span className="text-ink-3">
                  {t('detail.progressPages', {
                    current: book.currentPage,
                    total: book.pages,
                    percent: progress,
                  })}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
                <div
                  className="h-full rounded-full bg-gold-deep transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              onClick={() => setEditingBook(true)}
              className="h-10 rounded-full border border-gold-deep/40 px-5 text-xs text-gold-deep transition-colors hover:bg-gold-soft/60 active:scale-[0.98]"
            >
              {t('detail.edit')}
            </button>
            <ReadButton bookId={book.id} />
            <FinishButton bookId={book.id} finished={book.status === 'finished'} />
          </div>
        </div>
      </div>

      {book.blurb && (
        <blockquote className="border-l-2 border-gold/70 py-1 pl-4 sm:pl-5">
          <p className="font-display text-[13px] leading-7 text-ink-2 sm:text-[15px]">
            {book.blurb}
          </p>
        </blockquote>
      )}

      <NoteSection
        type="review"
        title={t('section.review')}
        items={reviews}
        addLabel={t('section.reviewAdd')}
        emptyText={t('section.reviewEmpty')}
        onAdd={() => setNoteEditor({ type: 'review' })}
        onEdit={(note) => setNoteEditor({ type: note.type, note })}
        onDelete={setPendingDelete}
      />

      <NoteSection
        type="quote"
        title={t('section.quote')}
        items={quotes}
        addLabel={t('section.quoteAdd')}
        emptyText={t('section.quoteEmpty')}
        layout="grid"
        onAdd={() => setNoteEditor({ type: 'quote' })}
        onEdit={(note) => setNoteEditor({ type: note.type, note })}
        onDelete={setPendingDelete}
      />

      <NoteSection
        type="note"
        title={t('section.note')}
        items={others}
        addLabel={t('section.noteAdd')}
        emptyText={t('section.noteEmpty')}
        onAdd={() => setNoteEditor({ type: 'note' })}
        onEdit={(note) => setNoteEditor({ type: note.type, note })}
        onDelete={setPendingDelete}
      />

      <BookDialog open={editingBook} book={book} onClose={() => setEditingBook(false)} />

      <NoteDialog
        open={noteEditor !== null}
        bookId={book.id}
        note={noteEditor?.note}
        defaultType={noteEditor?.type ?? 'review'}
        onClose={() => setNoteEditor(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('detail.deleteNoteTitle')}
        description={t('detail.deleteNoteBody')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteNote(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

function NoteSection({
  type,
  title,
  items,
  addLabel,
  emptyText,
  layout = 'list',
  onAdd,
  onEdit,
  onDelete,
}: {
  type: Note['type']
  title: string
  items: Note[]
  addLabel: string
  emptyText: string
  layout?: 'list' | 'grid'
  onAdd: () => void
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}) {
  const { t, noteTypeLabel } = useI18n()

  return (
    <section>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[17px] text-ink">{title}</h2>
            <span className="text-[11px] text-ink-3 tabular-nums">
              {t('common.entryCount', { count: items.length })}
            </span>
          </div>
        </div>
        <button
          onClick={onAdd}
          aria-label={`${noteTypeLabel(type)}：${addLabel}`}
          className="h-8 shrink-0 rounded-full border border-gold-deep/35 px-3.5 text-[11px] text-gold-deep transition-colors hover:bg-gold-soft/60"
        >
          ＋ {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card-soft rounded-[20px] px-5 py-9 text-center">
          <p className="text-xs text-ink-3">{emptyText}</p>
        </div>
      ) : (
        <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
          {items.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  )
}

function ReadButton({ bookId }: { bookId: string }) {
  const { bumpRead } = useLibrary()
  const { t } = useI18n()
  return (
    <button
      onClick={() => bumpRead(bookId)}
      className="h-10 rounded-full border border-gold-deep/40 px-5 text-xs text-gold-deep transition-colors hover:bg-gold-soft/60 active:scale-[0.98]"
    >
      {t('detail.read')}
    </button>
  )
}

function FinishButton({ bookId, finished }: { bookId: string; finished: boolean }) {
  const { markFinished } = useLibrary()
  const { t } = useI18n()
  return (
    <button
      onClick={() => markFinished(bookId)}
      disabled={finished}
      className="h-10 rounded-full bg-ink px-5 text-xs font-medium text-[#fdf6ea] shadow-[0_12px_24px_-16px_rgba(44,24,16,0.9)] transition hover:bg-[#3b241a] active:scale-[0.98] disabled:bg-ink/25 disabled:shadow-none"
    >
      {t('detail.finish')}
    </button>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.1em] text-ink-3 sm:text-[11px]">{label}</p>
      <p className="mt-1 text-[13px] text-ink tabular-nums sm:text-sm">{value}</p>
    </div>
  )
}

function BookCover({ book }: { book: Book }) {
  const { t } = useI18n()
  const { coverSrc } = useLibrary()
  const cover = coverSrc(book)

  if (cover) {
    return (
      <img
        src={cover}
        alt={`${book.title} · ${book.author}`}
        className="w-[104px] shrink-0 self-start rounded-[3px] object-cover shadow-[2px_10px_28px_-8px_rgba(76,49,28,0.55)] sm:w-[190px] lg:w-[220px]"
        style={{ aspectRatio: '3 / 4.2' }}
      />
    )
  }

  const light = book.spineInk === 'light'
  return (
    <div
      className="w-[104px] shrink-0 self-start rounded-e-[5px] rounded-s-[2px] shadow-[2px_8px_22px_-6px_rgba(76,49,28,0.5)] sm:w-[190px] lg:w-[220px]"
      style={{
        backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${book.spineColor} 80%, #fff6e6) 0%, ${book.spineColor} 42%, color-mix(in oklab, ${book.spineColor} 72%, #2c1810) 100%)`,
      }}
    >
      <div
        className={`relative flex aspect-[3/4.2] flex-col items-center justify-center px-2.5 py-4 sm:px-5 sm:py-7 ${
          light ? 'text-[#fdf6ea]' : 'text-[#2c1810]'
        }`}
      >
        <div
          className="pointer-events-none absolute inset-1.5 rounded-[3px] border sm:inset-2.5"
          style={{ borderColor: light ? 'rgba(253,246,234,0.3)' : 'rgba(44,24,16,0.2)' }}
        />
        <span
          className="text-[7px] tracking-[0.28em] opacity-55 sm:text-[9px]"
          style={{ writingMode: 'vertical-rl' }}
        >
          {t('detail.coverLabel')}
        </span>
        <h2 className="font-display mt-3 line-clamp-3 text-center text-[13px] leading-snug tracking-[0.02em] sm:mt-5 sm:text-xl">
          {book.title}
        </h2>
        <span
          className="mt-2.5 h-px w-6 sm:mt-4 sm:w-9"
          style={{ background: light ? 'rgba(253,246,234,0.45)' : 'rgba(44,24,16,0.3)' }}
        />
        <span className="mt-2 truncate text-[8px] opacity-75 sm:mt-3 sm:text-[11px]">
          {book.author}
        </span>
      </div>
    </div>
  )
}
