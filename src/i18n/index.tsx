import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en } from './en'
import { zh, type DictKey } from './zh'

export type Lang = 'zh' | 'en'

type Vars = Record<string, string | number>

export interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: DictKey, vars?: Vars) => string
  categoryName: (id: string) => string
  statusLabel: (status: 'unread' | 'reading' | 'finished' | 'paused') => string
  noteTypeLabel: (type: 'quote' | 'review' | 'note') => string
}

const dictionaries: Record<Lang, Record<DictKey, string>> = { zh, en }

const STORAGE_KEY = 'icebook.lang'

const detectLang = (): Lang => {
  if (typeof window === 'undefined') return 'zh'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {
    // 隐私模式下 localStorage 可能不可用，按浏览器语言猜一次
  }
  return window.navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

const interpolate = (template: string, vars?: Vars) => {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] != null ? String(vars[name]) : match,
  )
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((next: Lang) => setLangState(next), [])

  const t = useCallback(
    (key: DictKey, vars?: Vars) => {
      const dict = dictionaries[lang]
      return interpolate(dict[key] ?? zh[key] ?? key, vars)
    },
    [lang],
  )

  const categoryName = useCallback(
    (id: string) => {
      const key = `category.${id}` as DictKey
      const value = dictionaries[lang][key]
      return value ?? id
    },
    [lang],
  )

  const statusLabel = useCallback(
    (status: 'unread' | 'reading' | 'finished' | 'paused') =>
      t(`status.${status}` as DictKey),
    [t],
  )

  const noteTypeLabel = useCallback(
    (type: 'quote' | 'review' | 'note') => t(`noteType.${type}` as DictKey),
    [t],
  )

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title = t('meta.title')
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // 存不了就算了，不影响页面
    }
  }, [lang, t])

  const value = useMemo(
    () => ({ lang, setLang, t, categoryName, statusLabel, noteTypeLabel }),
    [lang, setLang, t, categoryName, statusLabel, noteTypeLabel],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
