import { useMemo } from 'react'

function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1])
  const list: (number | '…')[] = []
  let prev = 0
  for (const p of [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)) {
    if (prev && p - prev > 1) list.push('…')
    list.push(p)
    prev = p
  }
  return list
}

export default function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  const items = useMemo(() => pageList(page, totalPages), [page, totalPages])
  if (totalPages <= 1) return null

  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm transition-colors disabled:opacity-40'
  const base =
    'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
  const active = 'border-brand bg-brand text-white'

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="分页">
      <button className={`${btn} ${base}`} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {items.map((it, i) =>
        it === '…' ? (
          <span key={`e${i}`} className="px-1 text-gray-400 dark:text-gray-500">
            …
          </span>
        ) : (
          <button
            key={it}
            className={`${btn} ${it === page ? active : base}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onChange(it)}
          >
            {it}
          </button>
        ),
      )}
      <button className={`${btn} ${base}`} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        ›
      </button>
    </nav>
  )
}
