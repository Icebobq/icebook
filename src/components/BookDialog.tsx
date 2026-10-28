import { useEffect, useRef, useState } from 'react'
import { lookupCover, type CoverLookupResult } from '../data/covers'
import { categories, type Book, type BookStatus } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

const today = () => new Date().toISOString().slice(0, 10)

const statusOptions: BookStatus[] = ['unread', 'reading', 'finished', 'paused']

interface BookForm {
  title: string
  author: string
  categoryId: string
  price: string
  purchasedAt: string
  pages: string
  currentPage: string
  status: BookStatus
  rating: string
  blurb: string
  coverUrl: string
}

const emptyForm = (): BookForm => ({
  title: '',
  author: '',
  categoryId: categories[0].id,
  price: '',
  purchasedAt: today(),
  pages: '',
  currentPage: '0',
  status: 'unread',
  rating: '0',
  blurb: '',
  coverUrl: '',
})

const formOf = (book: Book): BookForm => ({
  title: book.title,
  author: book.author,
  categoryId: book.categoryId,
  price: book.price ? String(book.price) : '',
  purchasedAt: book.purchasedAt,
  pages: book.pages ? String(book.pages) : '',
  currentPage: String(book.currentPage),
  status: book.status,
  rating: String(book.rating),
  blurb: book.blurb,
  coverUrl: book.coverUrl ?? '',
})

export function BookDialog({
  open,
  onClose,
  book,
}: {
  open: boolean
  onClose: () => void
  book?: Book
}) {
  const { addBook, updateBook, cacheCover } = useLibrary()
  const { t, categoryName, statusLabel } = useI18n()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<BookForm>(emptyForm)
  const [error, setError] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [coverHit, setCoverHit] = useState<CoverLookupResult | null>(null)
  const [previewBroken, setPreviewBroken] = useState(false)
  const isEdit = Boolean(book)

  useEffect(() => {
    if (!open) return
    setForm(book ? formOf(book) : emptyForm())
    setError('')
    setCoverNote('')
    setCoverBusy(false)
    setCoverHit(null)
    setPreviewBroken(false)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      window.clearTimeout(timer)
    }
  }, [open, book, onClose])

  if (!open) return null

  const findCover = async () => {
    if (!form.title.trim()) {
      setError(t('error.titleRequired'))
      return
    }
    setError('')
    setCoverBusy(true)
    setCoverNote('')
    const hit = await lookupCover({ title: form.title.trim(), author: form.author.trim() })
    setCoverBusy(false)
    if (hit) {
      setPreviewBroken(false)
      setForm((prev) => ({ ...prev, coverUrl: hit.url }))
      setCoverHit(hit)
      setCoverNote('')
    } else {
      setCoverNote(t('cover.notFound'))
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      setError(t('error.titleRequired'))
      return
    }

    const pages = Number(form.pages) || 0
    const price = Number(form.price) || 0
    const purchasedAt = form.purchasedAt || today()
    const coverUrl = form.coverUrl.trim()
    // 封面是“自动获取”来的才带着图片，手动填的链接没有
    const autoHit = coverHit && coverHit.url === coverUrl ? coverHit : null

    if (isEdit && book) {
      const currentPage = Math.min(Number(form.currentPage) || 0, pages || 0)
      updateBook(book.id, {
        title: form.title.trim(),
        author: form.author.trim() || t('common.unknownAuthor'),
        categoryId: form.categoryId,
        price,
        purchasedAt,
        pages,
        currentPage: form.status === 'finished' && pages > 0 ? pages : currentPage,
        status: form.status,
        rating: Number(form.rating) || 0,
        blurb: form.blurb.trim(),
        ...(coverUrl === (book.coverUrl ?? '')
          ? {}
          : {
              coverUrl: coverUrl || undefined,
              coverSource: coverUrl ? (autoHit?.source ?? 'manual') : undefined,
            }),
        ...(coverUrl ? { coverCheckedAt: today() } : {}),
      })
      if (autoHit?.image) {
        void cacheCover(book.id, autoHit.image, { source: autoHit.source, url: coverUrl })
      }
    } else {
      const id = addBook({
        title: form.title,
        author: form.author,
        categoryId: form.categoryId,
        price,
        purchasedAt,
        pages,
        coverUrl,
      })
      if (autoHit?.image) {
        void cacheCover(id, autoHit.image, { source: autoHit.source, url: coverUrl })
      }
    }

    setError('')
    onClose()
  }

  // 自动获取到的封面直接用内嵌图片预览，避免浏览器直连豆瓣图床被拦
  const previewUrl =
    coverHit?.image && coverHit.url === form.coverUrl.trim()
      ? `data:${coverHit.image.mime};base64,${coverHit.image.data}`
      : form.coverUrl.trim()

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
        aria-labelledby="book-dialog-title"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] bg-surface p-5 shadow-[0_-10px_50px_-10px_rgba(44,24,16,0.5)] sm:max-w-lg sm:rounded-[26px] sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 id="book-dialog-title" className="font-display text-[19px] text-ink">
              {isEdit ? t('bookDialog.editTitle') : t('bookDialog.addTitle')}
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
          <Field label={t('field.title')} required>
            <input
              ref={firstFieldRef}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('field.titlePlaceholder')}
              className={inputCls}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('field.author')}>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder={t('field.optional')}
                className={inputCls}
              />
            </Field>
            <Field label={t('field.category')}>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryName(c.id)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t('field.cover')}>
            <div className="flex items-center gap-2">
              <input
                value={form.coverUrl}
                onChange={(e) => {
                  setPreviewBroken(false)
                  setCoverHit(null)
                  setForm({ ...form, coverUrl: e.target.value })
                }}
                placeholder={t('field.coverPlaceholder')}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void findCover()}
                disabled={coverBusy}
                className="h-11 shrink-0 rounded-full border border-gold-deep/40 px-3.5 text-[11px] text-gold-deep transition-colors hover:bg-gold-soft/60 disabled:text-ink-3"
              >
                {coverBusy ? t('cover.looking') : t('cover.auto')}
              </button>
            </div>
            {previewUrl && !previewBroken && (
              <img
                src={previewUrl}
                alt=""
                onError={() => setPreviewBroken(true)}
                className="mt-2.5 h-24 w-[72px] rounded-[4px] object-cover shadow-[2px_6px_16px_-6px_rgba(76,49,28,0.5)]"
              />
            )}
            {coverNote && <p className="mt-1.5 pl-1 text-[10px] text-ink-3">{coverNote}</p>}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('field.price')}>
              <input
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </Field>
            <Field label={t('field.purchasedAt')}>
              <input
                type="date"
                value={form.purchasedAt}
                onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label={t('field.pages')}>
              <input
                inputMode="numeric"
                value={form.pages}
                onChange={(e) => setForm({ ...form, pages: e.target.value })}
                placeholder="0"
                className={inputCls}
              />
            </Field>
          </div>

          {isEdit && (
            <>
              <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr]">
                <Field label={t('field.status')}>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as BookStatus })}
                    className={inputCls}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('field.currentPage')}>
                  <input
                    inputMode="numeric"
                    value={form.currentPage}
                    onChange={(e) => setForm({ ...form, currentPage: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label={t('field.rating')}>
                  <select
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    className={inputCls}
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n === 0
                          ? t('field.ratingNone')
                          : `${'★'.repeat(n)} ${t('field.ratingStars', { count: n })}`}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t('field.blurb')}>
                <textarea
                  value={form.blurb}
                  onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                  rows={3}
                  placeholder={t('field.blurbPlaceholder')}
                  className={textareaCls}
                />
              </Field>
            </>
          )}

          {error && <p className="text-xs text-[#a4553f]">{error}</p>}

          <div className="flex gap-3 pt-2">
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
              {isEdit ? t('common.save') : t('bookDialog.addAction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'h-11 w-full rounded-full bg-paper px-4 text-sm text-ink outline-none transition-shadow shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-gold)]'

const textareaCls =
  'w-full resize-none rounded-[18px] bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition-shadow shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_1.5px_var(--color-gold)]'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block pl-1 text-[11px] tracking-[0.06em] text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-[#a4553f]">*</span>}
      </span>
      {children}
    </label>
  )
}
