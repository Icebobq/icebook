import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteCard } from '../components/NoteCard'
import { NoteDialog } from '../components/NoteDialog'
import type { Note } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

const typeFilterIds = ['all', 'quote', 'review', 'note'] as const

type FilterId = (typeof typeFilterIds)[number]

/** 列数跟随断点：<640 一列，<1024 两列，再往上三列 */
function useColumnCount() {
  const [count, setCount] = useState(() =>
    window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1,
  )

  useEffect(() => {
    const sm = window.matchMedia('(min-width: 640px)')
    const lg = window.matchMedia('(min-width: 1024px)')
    const update = () => setCount(lg.matches ? 3 : sm.matches ? 2 : 1)
    sm.addEventListener('change', update)
    lg.addEventListener('change', update)
    return () => {
      sm.removeEventListener('change', update)
      lg.removeEventListener('change', update)
    }
  }, [])

  return count
}

/** 粗估卡片高度：句子类字号更大，按字数折算 */
const noteWeight = (note: Note) => (note.type === 'quote' ? note.content.length * 1.5 : note.content.length)

export function NotesPage() {
  const { notes, books, deleteNote } = useLibrary()
  const { t } = useI18n()
  const [type, setType] = useState<FilterId>('all')
  const [onlyFavorite, setOnlyFavorite] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null)

  const labels: Record<FilterId, string> = {
    all: t('notes.filterAll'),
    quote: t('notes.filterQuote'),
    review: t('notes.filterReview'),
    note: t('notes.filterNote'),
  }

  const visible = useMemo(
    () =>
      notes
        .filter((n) => (type === 'all' ? true : n.type === type))
        .filter((n) => (onlyFavorite ? n.favorite : true))
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes, type, onlyFavorite],
  )

  const columnCount = useColumnCount()

  // 自己分列做错落布局：CSS columns 会把卡片按列切口截断、连投影一起裁掉
  const columns = useMemo(() => {
    const buckets: Note[][] = Array.from({ length: columnCount }, () => [])
    const heights = new Array<number>(columnCount).fill(0)
    for (const note of visible) {
      let target = 0
      for (let i = 1; i < columnCount; i += 1) if (heights[i] < heights[target]) target = i
      buckets[target].push(note)
      heights[target] += noteWeight(note) + 48
    }
    return buckets
  }, [visible, columnCount])

  const bookOf = (id: string) => books.find((b) => b.id === id)

  return (
    <div className="space-y-7">
      <h1 className="font-display text-[30px] leading-[1.15] text-ink sm:text-[38px]">
        {t('notes.title')}
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        {typeFilterIds.map((id) => (
          <button
            key={id}
            onClick={() => setType(id)}
            aria-pressed={type === id}
            className={`h-8 shrink-0 rounded-full px-3.5 text-xs transition-colors ${
              type === id
                ? 'bg-gold font-medium text-ink shadow-[0_8px_18px_-12px_rgba(184,135,74,0.9)]'
                : 'bg-surface text-ink-2 hover:bg-gold-soft/60 hover:text-ink'
            }`}
          >
            {labels[id]}
          </button>
        ))}

        <button
          onClick={() => setOnlyFavorite((v) => !v)}
          aria-pressed={onlyFavorite}
          className={`ml-auto h-8 shrink-0 rounded-full px-3.5 text-xs transition-colors ${
            onlyFavorite
              ? 'bg-gold-soft font-medium text-gold-deep'
              : 'bg-surface text-ink-2 hover:bg-gold-soft/60 hover:text-ink'
          }`}
        >
          ★ {t('notes.onlyFavorites')}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card-soft rounded-[22px] px-6 py-16 text-center">
          <p className="font-display text-[15px] text-ink">{t('notes.emptyTitle')}</p>
          <p className="mt-2 text-xs text-ink-3">{t('notes.emptyBody')}</p>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          {columns.map((column, index) => (
            <div key={index} className="flex min-w-0 flex-1 flex-col gap-4">
              {column.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  book={bookOf(note.bookId)}
                  showBook
                  onEdit={setEditing}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <NoteDialog
        open={editing !== null}
        note={editing ?? undefined}
        bookId={editing?.bookId ?? ''}
        defaultType={editing?.type}
        onClose={() => setEditing(null)}
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
