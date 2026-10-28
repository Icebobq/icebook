import { useI18n, type Lang } from '../i18n'

const labels: Record<Lang, string> = { zh: '中文', en: 'EN' }

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()

  return (
    <div
      role="group"
      aria-label="Language / 语言"
      className={`flex h-8 items-center gap-0.5 rounded-full bg-surface p-0.5 shadow-[0_8px_22px_-20px_rgba(44,24,16,0.7)] ${className}`}
    >
      {(Object.keys(labels) as Lang[]).map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`h-7 rounded-full px-2.5 text-[10px] tracking-[0.06em] transition-colors ${
            lang === code
              ? 'bg-gold-soft font-medium text-ink'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          {labels[code]}
        </button>
      ))}
    </div>
  )
}
