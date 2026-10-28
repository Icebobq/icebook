import { useEffect, useRef, useState } from 'react'
import type { Note } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

export function NoteDialog({
  open,
  onClose,
  bookId,
  note,
  defaultType = 'review',
}: {
  open: boolean
  onClose: () => void
  bookId: string
  note?: Note
  defaultType?: Note['type']
}) {
  const { addNote, updateNote } = useLibrary()
  const { t } = useI18n()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [type, setType] = useState<Note['type']>(defaultType)
  const [content, setContent] = useState('')
  const [pageNo, setPageNo] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [error, setError] = useState('')
  const isEdit = Boolean(note)

  const typeOptions: Array<{ id: Note['type']; label: string; hint: string }> = [
    { id: 'review', label: t('noteType.review'), hint: t('noteDialog.reviewHint') },
    { id: 'quote', label: t('noteType.quote'), hint: t('noteDialog.quoteHint') },
    { id: 'note', label: t('noteType.note'), hint: t('noteDialog.noteHint') },
  ]

  useEffect(() => {
    if (!open) return
    setType(note?.type ?? defaultType)
    setContent(note?.content ?? '')
    setPageNo(note?.pageNo != null ? String(note.pageNo) : '')
    setFavorite(note?.favorite ?? false)
    setError('')

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => contentRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      window.clearTimeout(timer)
    }
  }, [open, note, defaultType, onClose])

  if (!open) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      setError(t('error.contentRequired'))
      return
    }

    const parsedPage = Number(pageNo)
    const input = {
      type,
      content: content.trim(),
      pageNo:
        type === 'quote' && Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : undefined,
      favorite,
    }

    if (isEdit && note) updateNote(note.id, input)
    else addNote(bookId, input)

    onClose()
  }

  const current = typeOptions.find((option) => option.id === type) ?? typeOptions[0]

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
        aria-labelledby="note-dialog-title"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] bg-surface p-5 shadow-[0_-10px_50px_-10px_rgba(44,24,16,0.5)] sm:max-w-lg sm:rounded-[26px] sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 id="note-dialog-title" className="font-display text-[19px] text-ink">
              {isEdit ? t('noteDialog.editTitle') : t('noteDialog.newTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mt-1 -mr-1 grid size-8 place-items-center rounded-full text-ink-2 transition-colors hover:bg-paper-2"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div role="group" aria-label={t('noteDialog.typeGroup')} className="flex gap-2">
            {typeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setType(option.id)}
                aria-pressed={type === option.id}
                className={`h-9 flex-1 rounded-full text-xs transition-colors ${
                  type === option.id
                    ? 'bg-gold font-medium text-ink shadow-[0_8px_18px_-12px_rgba(184,135,74,0.9)]'
                    : 'bg-paper text-ink-2 hover:bg-gold-soft/60'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={type === 'quote' ? 4 : 7}
            placeholder={current.hint}
            className="w-full resize-none rounded-[20px] bg-paper px-4 py-3.5 text-sm leading-7 text-ink outline-none transition-shadow shadow-[inset_0_0_0_1px_var(--color-line)] placeholder:text-ink-3 focus:shadow-[inset_0_0_0_1.5px_var(--color-gold)]"
          />

          <div className="flex items-center gap-3">
            {type === 'quote' && (
              <label className="flex h-11 items-center gap-2 rounded-full bg-paper px-4 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <span className="text-[11px] text-ink-2">{t('noteDialog.page')}</span>
                <input
                  inputMode="numeric"
                  value={pageNo}
                  onChange={(e) => setPageNo(e.target.value)}
                  placeholder="P."
                  className="w-14 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => setFavorite((v) => !v)}
              aria-pressed={favorite}
              className={`ml-auto flex h-11 items-center gap-1.5 rounded-full px-4 text-xs transition-colors ${
                favorite
                  ? 'bg-gold-soft font-medium text-gold-deep'
                  : 'bg-paper text-ink-2 hover:bg-gold-soft/60'
              }`}
            >
              <span aria-hidden>★</span>
              {favorite ? t('noteDialog.favorited') : t('noteDialog.favorite')}
            </button>
          </div>

          {error && <p className="text-xs text-[#a4553f]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded-full border border-gold-deep/40 text-sm text-gold-deep transition-colors hover:bg-gold-soft/50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="h-11 flex-[1.4] rounded-full bg-ink text-sm font-medium text-[#fdf6ea] shadow-[0_14px_26px_-16px_rgba(44,24,16,0.9)] transition hover:bg-[#3b241a]"
            >
              {isEdit ? t('common.save') : t('noteDialog.saveNew')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
