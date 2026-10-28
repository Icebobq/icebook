import { useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../data/library'
import { useI18n } from '../i18n'
import { useLibrary } from '../store/library'

const widthByThickness: Record<1 | 2 | 3, number> = { 1: 30, 2: 42, 3: 54 }

const LONG_PRESS_MS = 500

const spineHeight = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 997
  return 172 + (h % 44)
}

/** 把封面图当作书脊的一窄条来用：整条压暗 + 两侧再压深，让竖排书名在任何封面上都保持对比 */
const coverLayers = (coverUrl: string, synthetic: string) => {
  const safeUrl = coverUrl.replace(/"/g, '%22')
  return `linear-gradient(90deg, var(--spine-scrim-strong) 0%, var(--spine-scrim) 24%, var(--spine-scrim) 76%, var(--spine-scrim-strong) 100%), url("${safeUrl}"), ${synthetic}`
}

export function BookSpine({
  book,
  onLongPress,
}: {
  book: Book
  onLongPress?: (book: Book) => void
}) {
  const { t } = useI18n()
  const { coverSrc } = useLibrary()
  const timerRef = useRef<number | null>(null)
  const longPressedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startPress = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (!onLongPress) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    longPressedRef.current = false
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true
      onLongPress(book)
    }, LONG_PRESS_MS)
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (longPressedRef.current) {
      e.preventDefault()
      longPressedRef.current = false
    }
  }

  const c = book.spineColor
  const cover = coverSrc(book)
  const hasCover = Boolean(cover)
  const ink = hasCover
    ? 'rgba(255,250,242,0.98)'
    : book.spineInk === 'light'
      ? 'rgba(255,250,242,0.95)'
      : 'rgba(44,24,16,0.88)'
  const inkSoft = hasCover
    ? 'rgba(255,250,242,0.55)'
    : book.spineInk === 'light'
      ? 'rgba(255,250,242,0.62)'
      : 'rgba(44,24,16,0.55)'

  // 按视觉字宽收敛字号，避免长书名在书脊上被截断
  const visualLen = [...book.title].reduce(
    (n, ch) => n + (/[\u4e00-\u9fff]/.test(ch) ? 1 : 0.58),
    0,
  )
  const fontSize = visualLen > 10.5 ? 10 : visualLen > 8 ? 11 : 12
  const dense = visualLen > 10.5

  const synthetic = `linear-gradient(100deg, color-mix(in oklab, ${c} 72%, #2c1810) 0%, ${c} 16%, color-mix(in oklab, ${c} 76%, #fff6e6) 38%, ${c} 58%, color-mix(in oklab, ${c} 66%, #2c1810) 82%, color-mix(in oklab, ${c} 84%, #2c1810) 100%)`

  return (
    <Link
      to={`/books/${book.id}`}
      aria-label={t('spine.aria', { title: book.title, author: book.author })}
      title={`${book.title} · ${book.author}`}
      onPointerDown={startPress}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onClick={handleClick}
      onContextMenu={(e) => {
        if (!onLongPress) return
        e.preventDefault()
        onLongPress(book)
      }}
      onDragStart={(e) => e.preventDefault()}
      className="spine-book group relative block shrink-0 origin-bottom touch-manipulation rounded-e-[3px] rounded-s-[1px] transition-transform duration-300 ease-out select-none will-change-transform hover:-translate-y-2 focus-visible:-translate-y-2"
      style={
        {
          width: widthByThickness[book.thickness],
          '--spine-h': `${spineHeight(book.id)}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={`flex h-full w-full flex-col items-center overflow-hidden rounded-e-[3px] rounded-s-[1px] px-1 shadow-[1px_3px_6px_-1px_rgba(76,49,28,0.36)] transition-shadow duration-300 group-hover:shadow-[2px_16px_20px_-8px_rgba(76,49,28,0.5)] ${
          dense ? 'py-1.5' : 'py-2.5'
        }`}
        style={{
          backgroundImage: hasCover ? coverLayers(cover!, synthetic) : synthetic,
          backgroundSize: hasCover ? 'cover, auto 100%, cover' : undefined,
          backgroundPosition: hasCover ? 'center, left center, center' : undefined,
          backgroundRepeat: hasCover ? 'no-repeat' : undefined,
        }}
      >
        {/* 书脊上下压印线 */}
        {!dense && (
          <span
            className="mb-2 h-px w-[62%] shrink-0"
            style={{ background: inkSoft, opacity: 0.5 }}
          />
        )}
        <span
          className="spine-text font-display flex min-h-0 flex-1 items-center justify-center overflow-hidden leading-none whitespace-nowrap"
          style={{
            color: ink,
            letterSpacing: '0.07em',
            fontSize,
            textShadow: hasCover
              ? '0 1px 2px rgba(0,0,0,0.7), 0 0 5px rgba(0,0,0,0.55)'
              : book.spineInk === 'light'
                ? '0 1px 1px rgba(0,0,0,0.3)'
                : 'none',
          }}
        >
          {book.title}
        </span>
        {!dense && (
          <span
            className="mt-2 h-px w-[62%] shrink-0"
            style={{ background: inkSoft, opacity: 0.5 }}
          />
        )}
      </div>
    </Link>
  )
}
