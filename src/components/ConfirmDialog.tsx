import { useEffect } from 'react'
import { useI18n } from '../i18n'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  cancelText,
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <button
        aria-label={t('common.close')}
        onClick={onCancel}
        className="absolute inset-0 bg-[#2c1810]/40 backdrop-blur-[2px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-[360px] rounded-[24px] bg-surface p-6 shadow-[0_24px_60px_-20px_rgba(44,24,16,0.6)]"
      >
        <h2 id="confirm-title" className="font-display text-[17px] text-ink">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-xs leading-6 text-ink-2">{description}</p>
        )}
        <div className="mt-6 flex gap-2.5">
          <button
            onClick={onCancel}
            className="h-10 flex-1 rounded-full border border-gold-deep/40 text-xs text-gold-deep transition-colors hover:bg-gold-soft/50"
          >
            {cancelText ?? t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`h-10 flex-1 rounded-full text-xs font-medium text-[#fdf6ea] transition active:scale-[0.98] ${
              tone === 'danger'
                ? 'bg-[#8c3f3a] hover:bg-[#7a352f]'
                : 'bg-ink hover:bg-[#3b241a]'
            }`}
          >
            {confirmText ?? t('common.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  )
}
