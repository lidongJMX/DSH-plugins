import { Link } from 'react-router-dom'
import type { Plugin } from '../lib/types'
import { CATEGORY_LABEL, TYPE_META } from '../lib/constants'
import { formatStars, formatDate, imgUrl } from '../lib/store'
import Badge from './Badge'
import CopyButton from './CopyButton'

const AVATAR_COLORS = [
  'bg-brand',
  'bg-indigo-500',
  'bg-sky-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
]

function hashColor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export default function PluginCard({ plugin: p }: { plugin: Plugin }) {
  const hero = p.images.length > 0 ? imgUrl(p, p.images[0].file) : null
  const typeMeta = TYPE_META[p.type]

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand/50">
      {/* 拉伸链接：整卡可点，且不包裹内部交互元素 */}
      <Link
        to={`/plugin/${p.owner}/${p.name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
        aria-label={`查看 ${p.fullName} 详情`}
      >
        <span className="sr-only">查看 {p.fullName} 详情</span>
      </Link>

      {hero && (
        <div className="pointer-events-none h-28 overflow-hidden border-b border-gray-100 bg-gray-100 dark:border-gray-800 dark:bg-gray-800">
          <img
            src={hero}
            alt={p.images[0].alt || p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white ${hashColor(p.owner)}`}
            aria-hidden="true"
          >
            {p.owner[0]?.toUpperCase() ?? '?'}
          </span>
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" title={p.fullName}>
            {p.name}
          </h3>
          <Badge className={typeMeta.className}>{typeMeta.label}</Badge>
        </div>

        <p className="line-clamp-2 min-h-9 text-xs leading-5 text-gray-500 dark:text-gray-400">{p.intro}</p>

        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1 text-amber-500" title={`${p.stars} stars`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M12 2l2.9 6.26 6.86.8-5.07 4.7 1.36 6.76L12 17.1l-6.05 3.42 1.36-6.76-5.07-4.7 6.86-.8L12 2Z" />
            </svg>
            {formatStars(p.stars)}
          </span>
          {p.language && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-light" aria-hidden="true" />
              {p.language}
            </span>
          )}
          <span className="ml-auto">{formatDate(p.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {CATEGORY_LABEL[p.category] ?? p.category}
          </Badge>
          {/* 置于拉伸链接之上 */}
          <span className="relative z-20 ml-auto">
            <CopyButton text={p.install.command} />
          </span>
        </div>
      </div>
    </article>
  )
}
