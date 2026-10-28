import { useEffect, useRef, useState } from 'react'
import { parseSnapshot } from '../data/repository'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'
import { ConfirmDialog } from './ConfirmDialog'

export function DataMenu() {
  const {
    books,
    notes,
    exportSnapshot,
    importSnapshot,
    clearLibrary,
    storageError,
    coverSync,
    syncCovers,
  } = useLibrary()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [pendingImport, setPendingImport] = useState<{
    raw: string
    bookCount: number
    noteCount: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const handleExport = () => {
    const snapshot = exportSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `icebook-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setOpen(false)
    setError(null)
    setNotice(t('data.exported'))
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const raw = await file.text()
      const parsed = parseSnapshot(raw)
      setOpen(false)
      setPendingImport({
        raw,
        bookCount: parsed.books.length,
        noteCount: parsed.notes.length,
      })
    } catch {
      setError(t('data.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  const runImport = async (raw: string) => {
    setBusy(true)
    setError(null)
    try {
      const { books: bookCount, notes: noteCount } = await importSnapshot(raw)
      setNotice(t('data.imported', { books: bookCount, notes: noteCount }))
    } catch {
      setError(t('data.importFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    setConfirmClear(false)
    setBusy(true)
    try {
      await clearLibrary()
      setOpen(false)
      setNotice(t('data.cleared'))
    } catch {
      setError(t('data.clearFailed'))
    } finally {
      setBusy(false)
    }
  }

  const handleSyncCovers = async () => {
    setError(null)
    const { found, total } = await syncCovers()
    setOpen(false)
    if (total === 0) {
      setNotice(t('cover.allChecked'))
      return
    }
    setNotice(found > 0 ? t('cover.syncResult', { found }) : t('cover.syncNone'))
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => {
          setOpen((v) => !v)
          setError(null)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-1.5 rounded-full border border-gold-deep/35 px-3.5 text-xs text-gold-deep transition-colors hover:bg-gold-soft/50 sm:h-11 sm:px-4"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <ellipse cx="8" cy="3.6" rx="5" ry="1.9" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M3 3.6v8.8c0 1.05 2.24 1.9 5 1.9s5-.85 5-1.9V3.6"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path d="M3 8c0 1.05 2.24 1.9 5 1.9s5-.85 5-1.9" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {t('data.button')}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[238px] rounded-[18px] bg-surface p-1.5 shadow-[0_22px_50px_-18px_rgba(44,24,16,0.5)]"
        >
          <button
            role="menuitem"
            onClick={handleExport}
            className="flex w-full items-center justify-between rounded-[13px] px-3.5 py-2.5 text-left text-xs text-ink transition-colors hover:bg-paper-2/70"
          >
            {t('data.export')}
            <span aria-hidden className="text-[10px] text-ink-3">
              ↓
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-between rounded-[13px] px-3.5 py-2.5 text-left text-xs text-ink transition-colors hover:bg-paper-2/70 disabled:text-ink-3"
          >
            {busy ? t('data.importing') : t('data.import')}
            <span aria-hidden className="text-[10px] text-ink-3">
              ↑
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => void handleSyncCovers()}
            disabled={coverSync.running}
            className="flex w-full items-center justify-between rounded-[13px] px-3.5 py-2.5 text-left text-xs text-ink transition-colors hover:bg-paper-2/70 disabled:text-ink-3"
          >
            {coverSync.running
              ? t('cover.syncing', { done: coverSync.done, total: coverSync.total })
              : t('cover.sync')}
            <span aria-hidden className="text-[10px] text-ink-3">
              ⟳
            </span>
          </button>
          <div className="mx-2 my-1 h-px bg-line/70" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmClear(true)
            }}
            className="flex w-full items-center justify-between rounded-[13px] px-3.5 py-2.5 text-left text-xs text-[#a4553f] transition-colors hover:bg-[#f4e0d8]"
          >
            {t('data.clear')}
            <span aria-hidden className="text-[10px] text-[#c08a7c]">
              ✕
            </span>
          </button>

          {(error || storageError) && (
            <p className="px-3 pt-1.5 pb-1 text-[10px] leading-5 text-[#a4553f]">
              {error ?? storageError}
            </p>
          )}
          <p className="px-3 pt-1 pb-1.5 text-[10px] leading-5 text-ink-3">{t('data.footnote')}</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void handleImport(file)
        }}
      />

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center sm:bottom-8">
          <span className="rounded-full bg-ink px-4 py-2 text-[11px] text-[#fdf6ea] shadow-[0_16px_30px_-14px_rgba(44,24,16,0.8)]">
            {notice}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={pendingImport !== null}
        title={t('data.importTitle')}
        description={t('data.importBody', {
          fileBooks: pendingImport?.bookCount ?? 0,
          fileNotes: pendingImport?.noteCount ?? 0,
          localBooks: books.length,
          localNotes: notes.length,
        })}
        confirmText={t('data.importAction')}
        onCancel={() => setPendingImport(null)}
        onConfirm={() => {
          const raw = pendingImport?.raw
          setPendingImport(null)
          if (raw) void runImport(raw)
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title={t('data.clearTitle')}
        description={t('data.clearBody')}
        confirmText={t('data.clearAction')}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void handleClear()}
      />
    </div>
  )
}
