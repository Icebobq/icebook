import { NavLink, Outlet } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'
import { LangSwitch } from './LangSwitch'

const CURRENT_YEAR = new Date().getFullYear()

const navItems = [
  { to: '/', labelKey: 'nav.shelf' as const, icon: 'shelf' as const },
  { to: '/notes', labelKey: 'nav.notes' as const, icon: 'quote' as const },
  { to: '/stats', labelKey: 'nav.stats' as const, icon: 'stats' as const },
]

function NavIcon({
  name,
  active,
  tone = 'ink',
}: {
  name: 'shelf' | 'quote' | 'stats'
  active: boolean
  tone?: 'ink' | 'cream'
}) {
  const stroke =
    tone === 'cream'
      ? active
        ? '#2c1810'
        : 'rgba(44, 24, 16, 0.72)'
      : active
        ? 'var(--color-ink)'
        : 'var(--color-ink-2)'

  if (name === 'shelf') {
    return (
      <svg width="21" height="21" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M3 4.5h3.5v11H3zM7.5 6.5H11v9H7.5z" stroke={stroke} strokeWidth="1.3" />
        <path d="M13.4 3.6l2.9.8-2.5 10.9-2.9-.7z" stroke={stroke} strokeWidth="1.3" />
        <path d="M2 17h16" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'stats') {
    return (
      <svg width="21" height="21" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path
          d="M4 16V10.5M8.7 16V6.5M13.3 16V9M18 16V4"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path d="M2 17h16" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="21" height="21" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4.5 4h2.2A2.3 2.3 0 019 6.3V16a2 2 0 00-2-2H4.5zM15.5 4h-2.2A2.3 2.3 0 0011 6.3V16a2 2 0 012-2h2.5z"
        stroke={stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AppShell() {
  const { storage, storageError } = useLibrary()
  const { t } = useI18n()
  const year = CURRENT_YEAR

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30">
        <div className="border-b border-line/60 bg-paper/82 backdrop-blur-lg">
          <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[76px] sm:px-8">
            <NavLink to="/" className="group flex items-baseline gap-2">
              <span className="font-display text-[22px] leading-none tracking-[0.01em] text-ink sm:text-[26px]">
                Icebook
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-gold transition-colors group-hover:bg-gold-deep" />
            </NavLink>

            <nav className="hidden items-center gap-1 rounded-full bg-surface/70 p-1 shadow-[0_10px_24px_-20px_rgba(44,24,16,0.5)] sm:flex md:absolute md:left-1/2 md:-translate-x-1/2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-2 rounded-full px-5 py-2 text-[13px] transition-colors',
                      isActive
                        ? 'bg-gold-soft font-medium text-ink'
                        : 'text-ink-2 hover:bg-paper-2/70 hover:text-ink',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <NavIcon name={item.icon} active={isActive} />
                      {t(item.labelKey)}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <LangSwitch className="hidden sm:flex" />
            </div>
          </div>
        </div>
      </header>

      {storage === 'error' && storageError && (
        <div className="border-b border-[#a4553f]/15 bg-[#f4e0d8]">
          <p className="mx-auto max-w-6xl px-4 py-2 text-[11px] leading-5 text-[#8c3f3a] sm:px-8">
            {storageError}
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-12 sm:px-8 sm:pt-10 sm:pb-16">
        <Outlet />
      </main>

      <footer className="border-t border-line/60 bg-paper/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 pt-7 pb-[calc(80px+env(safe-area-inset-bottom))] text-center sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:pt-8 sm:pb-8 sm:text-left">
          <p className="font-display text-[15px] leading-none text-ink">Icebook</p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
            <p className="text-[10px] tracking-[0.04em] text-ink-3 tabular-nums">
              {t('footer.copyright', { year })}
            </p>
            <LangSwitch />
          </div>
        </div>
      </footer>

      {/* 移动端：金色渐变底栏（渐变放在最外层，安全区也一并着色） */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 bg-gradient-to-b from-gold to-[#CFA057] shadow-[0_-10px_28px_-14px_rgba(76,49,28,0.45)] sm:hidden">
        <div className="flex items-stretch justify-around px-3 pt-1.5 pb-1.5">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end className="flex-1">
              {({ isActive }) => (
                <span
                  className={`mx-auto flex min-h-[52px] max-w-[128px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors ${
                    isActive ? 'bg-[#FDF6EA] text-ink shadow-[0_2px_8px_-4px_rgba(76,49,28,0.45)]' : 'text-[#3f2a1a]'
                  }`}
                >
                  <NavIcon name={item.icon} active={isActive} tone="cream" />
                  <span className="text-[10px] tracking-[0.08em]">{t(item.labelKey)}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
