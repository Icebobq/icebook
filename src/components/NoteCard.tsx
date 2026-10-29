import { Link } from 'react-router-dom'
import type { Book, Note } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

export const noteTypeTone: Record<Note['type'], string> = {
  quote: 'bg-gold-soft text-gold-deep',
  review: 'bg-[#eadfce] text-[#6b5844]',
  note: 'bg-paper-2 text-ink-2',
}

export function NoteCard({
  note,
  book,
  showBook = false,
  onEdit,
  onDelete,
}: {
  note: Note
  book?: Book
  showBook?: boolean
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}) {
  const { t, noteTypeLabel } = useI18n()
  const { toggleFavorite } = useLibrary()
  const isQuote = note.type === 'quote'

  return (
    <article
      className="card-soft group/note rounded-[20px] p-4 transition-shadow duration-300 hover:shadow-[0_16px_34px_-20px_rgba(44,24,16,0.45)] sm:p-5"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] ${noteTypeTone[note.type]}`}>
          {noteTypeLabel(note.type)}
        </span>
        {note.pageNo != null && (
          <span className="text-[10px] text-ink-3 tabular-nums">
            {t('note.page', { page: note.pageNo })}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => toggleFavorite(note.id)}
            aria-label={note.favorite ? t('note.unfavorite') : t('note.favorite')}
            aria-pressed={note.favorite}
            className={`grid size-7 place-items-center rounded-full text-sm transition-colors ${
              note.favorite ? 'text-gold-deep' : 'text-line hover:text-ink-3'
            }`}
          >
            ★
          </button>
          <button
            onClick={() => onEdit(note)}
            aria-label={t('note.editAria')}
            className="grid size-7 place-items-center rounded-full text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M11.1 2.6l2.3 2.3-7.9 7.9-3 .7.7-3 7.9-7.9z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => onDelete(note)}
            aria-label={t('note.deleteAria')}
            className="grid size-7 place-items-center rounded-full text-[11px] text-ink-3 transition-colors hover:bg-paper-2 hover:text-[#a4553f]"
          >
            ✕
          </button>
        </div>
      </div>

      <p
        className={`font-display whitespace-pre-wrap ${
          isQuote ? 'text-[15px] leading-8 text-ink' : 'text-[13px] leading-7 text-ink/90'
        }`}
      >
        {isQuote
          ? `${t('note.quoteOpen')}${note.content}${t('note.quoteClose')}`
          : note.content}
      </p>

      <div className="mt-3.5 flex items-center gap-2 border-t border-line/60 pt-3 text-[10px] text-ink-3">
        {showBook &&
          (book ? (
            <Link
              to={`/books/${book.id}`}
              className="truncate text-ink-2 transition-colors hover:text-gold-deep hover:underline hover:underline-offset-2"
            >
              {`${t('note.bookOpen')}${book.title}${t('note.bookClose')}`}
            </Link>
          ) : (
            <span>{t('note.unknownBook')}</span>
          ))}
        <span className="ml-auto shrink-0 tabular-nums">{note.createdAt}</span>
      </div>
    </article>
  )
}
