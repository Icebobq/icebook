import { useMemo, useState } from 'react'
import { categories } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

const CURRENT_YEAR = new Date().getFullYear()

export function StatsPage() {
  const { books, notes } = useLibrary()
  const { t, lang, categoryName } = useI18n()

  const money = (value: number) =>
    `¥${Math.round(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}`

  const purchaseYears = useMemo(() => {
    const set = new Set<number>()
    for (const book of books) {
      const year = Number(book.purchasedAt.slice(0, 4))
      if (Number.isFinite(year) && year > 1900) set.add(year)
    }
    return [...set].sort((a, b) => b - a)
  }, [books])

  const chips = useMemo(
    () => (purchaseYears.includes(CURRENT_YEAR) ? purchaseYears : [CURRENT_YEAR, ...purchaseYears]),
    [purchaseYears],
  )

  const [pickedYear, setPickedYear] = useState<number | null>(null)

  // 默认落在藏书最多的年份，避免一进来就停在只有一两本书的年份
  const defaultYear = useMemo(() => {
    if (purchaseYears.length === 0) return CURRENT_YEAR
    const counts = new Map<number, number>()
    for (const book of books) {
      const y = Number(book.purchasedAt.slice(0, 4))
      if (Number.isFinite(y)) counts.set(y, (counts.get(y) ?? 0) + 1)
    }
    return [...purchaseYears].sort(
      (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || b - a,
    )[0]
  }, [books, purchaseYears])

  const year =
    pickedYear != null && chips.includes(pickedYear) ? pickedYear : defaultYear

  const yearBooks = useMemo(
    () => books.filter((b) => b.purchasedAt.startsWith(String(year))),
    [books, year],
  )

  const yearStats = useMemo(() => {
    const spent = yearBooks.reduce((sum, b) => sum + b.price, 0)
    const finished = yearBooks.filter((b) => b.status === 'finished').length
    const reads = yearBooks.reduce((sum, b) => sum + b.readCount, 0)
    return {
      count: yearBooks.length,
      spent,
      finished,
      reads,
      avgPrice: yearBooks.length ? spent / yearBooks.length : 0,
      finishRate: yearBooks.length ? Math.round((finished / yearBooks.length) * 100) : 0,
    }
  }, [yearBooks])

  const monthly = useMemo(() => {
    const values = Array.from({ length: 12 }, () => 0)
    for (const book of yearBooks) {
      const month = Number(book.purchasedAt.slice(5, 7))
      if (month >= 1 && month <= 12) values[month - 1] += book.price
    }
    return values
  }, [yearBooks])

  const maxMonth = Math.max(...monthly, 1)

  const categoryStats = useMemo(
    () =>
      categories
        .map((category) => {
          const items = yearBooks.filter((b) => b.categoryId === category.id)
          return {
            ...category,
            count: items.length,
            spent: items.reduce((sum, b) => sum + b.price, 0),
          }
        })
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [yearBooks],
  )

  const maxCategoryCount = Math.max(...categoryStats.map((c) => c.count), 1)

  const overall = useMemo(() => {
    const spent = books.reduce((sum, b) => sum + b.price, 0)
    const finished = books.filter((b) => b.status === 'finished').length
    const reads = books.reduce((sum, b) => sum + b.readCount, 0)
    return {
      count: books.length,
      spent,
      finished,
      reads,
      finishRate: books.length ? Math.round((finished / books.length) * 100) : 0,
      noteCount: notes.length,
    }
  }, [books, notes])

  const statusBreakdown = useMemo(() => {
    const reading = yearBooks.filter((b) => b.status === 'reading').length
    const unread = yearBooks.filter((b) => b.status === 'unread').length
    const paused = yearBooks.filter((b) => b.status === 'paused').length
    return { reading, unread, paused }
  }, [yearBooks])

  return (
    <div className="space-y-7 sm:space-y-8">
      <h1 className="font-display text-[30px] leading-[1.15] text-ink sm:text-[38px]">
        {t('stats.title')}
      </h1>

      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((y) => (
          <button
            key={y}
            onClick={() => setPickedYear(y)}
            aria-pressed={year === y}
            className={`h-8 shrink-0 rounded-full px-3.5 text-xs tabular-nums transition-colors ${
              year === y
                ? 'bg-gold font-medium text-ink shadow-[0_8px_18px_-12px_rgba(184,135,74,0.9)]'
                : 'bg-surface text-ink-2 hover:bg-gold-soft/60 hover:text-ink'
            }`}
          >
            {y}
            <span className="ml-1.5 text-[10px] text-ink-3">
              {books.filter((b) => b.purchasedAt.startsWith(String(y))).length}
            </span>
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('stats.yearSpent', { year })} value={money(yearStats.spent)} />
        <Stat
          label={t('stats.yearAdded')}
          value={`${yearStats.count}`}
          unit={t('unit.volume')}
        />
        <Stat
          label={t('stats.yearFinished')}
          value={`${yearStats.finished}`}
          unit={t('unit.volume')}
        />
        <Stat
          label={t('stats.yearReads')}
          value={`${yearStats.reads}`}
          unit={t('unit.times')}
        />
      </section>

      {yearBooks.length === 0 ? (
        <div className="card-soft rounded-[22px] px-6 py-14 text-center">
          <p className="font-display text-[15px] text-ink">{t('stats.emptyTitle')}</p>
          <p className="mt-2 text-xs text-ink-3">{t('stats.emptyBody')}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card-soft rounded-[22px] p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[16px] text-ink">{t('stats.monthly')}</h2>
              <span className="text-[11px] text-ink-3 tabular-nums">
                {t('stats.avgPrice', { amount: money(yearStats.avgPrice) })}
              </span>
            </div>

            <div className="mt-6 flex h-32 items-end gap-1 sm:gap-1.5">
              {monthly.map((value, index) => {
                const height = value > 0 ? Math.max(4, (value / maxMonth) * 100) : 0
                return (
                  <div
                    key={index}
                    className="group flex h-full flex-1 flex-col items-center justify-end"
                    title={t('stats.monthTip', { month: index + 1, amount: money(value) })}
                  >
                    <span className="mb-1 text-[9px] text-ink-3 tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                      {value > 0 ? value : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-[4px] ${
                        value > 0
                          ? 'bg-gold-deep'
                          : 'bg-paper-2'
                      }`}
                      style={{ height: value > 0 ? `${height}%` : '2px' }}
                    />
                  </div>
                )
              })}
            </div>

            <div className="mt-2 flex gap-1 sm:gap-1.5">
              {monthly.map((_, index) => (
                <span
                  key={index}
                  className="flex-1 text-center text-[9px] text-ink-3 tabular-nums"
                >
                  {index + 1}
                </span>
              ))}
            </div>
          </section>

          <section className="card-soft rounded-[22px] p-5 sm:p-6">
            <h2 className="font-display text-[16px] text-ink">{t('stats.categories')}</h2>

            <div className="mt-5 space-y-3.5">
              {categoryStats.map((category) => (
                <div key={category.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="truncate text-ink-2">{categoryName(category.id)}</span>
                    <span className="shrink-0 text-ink-3 tabular-nums">
                      {t('stats.categoryRow', {
                        count: category.count,
                        amount: money(category.spent),
                      })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
                    <div
                      className="h-full rounded-full bg-gold-deep"
                      style={{ width: `${(category.count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-soft rounded-[22px] p-5 sm:p-6">
            <h2 className="font-display text-[16px] text-ink">{t('stats.completion')}</h2>

            <div className="mt-5 flex items-end gap-3">
              <span className="font-display text-[38px] leading-none text-ink tabular-nums">
                {yearStats.finishRate}
                <span className="ml-0.5 font-sans-cn text-[14px] text-ink-3">%</span>
              </span>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-gold-deep transition-[width] duration-500"
                style={{ width: `${yearStats.finishRate}%` }}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Chip
                label={t('stats.chipReading', { count: statusBreakdown.reading })}
                tone="gold"
              />
              <Chip
                label={t('stats.chipUnread', { count: statusBreakdown.unread })}
                tone="plain"
              />
              <Chip
                label={t('stats.chipPaused', { count: statusBreakdown.paused })}
                tone="plain"
              />
              <Chip
                label={t('stats.chipFinished', { count: yearStats.finished })}
                tone="gold"
              />
            </div>
          </section>

          <section className="card-soft rounded-[22px] p-5 sm:p-6">
            <h2 className="font-display text-[16px] text-ink">{t('stats.overview')}</h2>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
              <MiniStat
                label={t('stats.overviewBooks')}
                value={t('common.volumeCount', { count: overall.count })}
              />
              <MiniStat label={t('stats.overviewSpent')} value={money(overall.spent)} />
              <MiniStat
                label={t('stats.overviewReads')}
                value={t('common.timesCount', { count: overall.reads })}
              />
              <MiniStat
                label={t('stats.overviewFinishRate')}
                value={`${overall.finishRate}%`}
              />
              <MiniStat
                label={t('stats.overviewFinished')}
                value={t('common.volumeCount', { count: overall.finished })}
              />
              <MiniStat
                label={t('stats.overviewNotes')}
                value={t('common.entryCount', { count: overall.noteCount })}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card-soft rounded-[18px] px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[10px] tracking-[0.14em] text-ink-3">{label}</p>
      <p className="font-display mt-1.5 text-[20px] leading-none text-ink tabular-nums sm:text-[24px]">
        {value}
        {unit && (
          <span className="ml-1 font-sans-cn text-[10px] font-normal tracking-[0.06em] text-ink-3">
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.1em] text-ink-3">{label}</p>
      <p className="mt-1 text-[14px] text-ink tabular-nums">{value}</p>
    </div>
  )
}

function Chip({ label, tone }: { label: string; tone: 'gold' | 'plain' }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] tabular-nums ${
        tone === 'gold' ? 'bg-gold-soft text-gold-deep' : 'bg-paper-2 text-ink-2'
      }`}
    >
      {label}
    </span>
  )
}
