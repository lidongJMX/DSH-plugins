import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PluginData } from '../lib/types'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PAGE_SIZE,
  PLUGIN_TYPES,
  SORTS,
  type SortKey,
} from '../lib/constants'
import { collectLanguages, filterPlugins, loadPlugins } from '../lib/store'
import PluginCard from '../components/PluginCard'
import Pagination from '../components/Pagination'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PluginData }

export default function ListPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let alive = true
    loadPlugins()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((e: unknown) =>
        alive && setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      alive = false
    }
  }, [])

  // ---- URL 即状态 ----
  const q = searchParams.get('q') ?? ''
  const cats = useMemo(
    () => (searchParams.get('cat') ?? '').split(',').filter(Boolean),
    [searchParams],
  )
  const typesRaw = searchParams.get('types')
  const types = useMemo<PluginData['plugins'][number]['type'][] | null>(() => {
    if (typesRaw === null) return PLUGIN_TYPES as PluginData['plugins'][number]['type'][]
    if (typesRaw === 'all') return null
    return typesRaw.split(',').filter(Boolean) as PluginData['plugins'][number]['type'][]
  }, [typesRaw])
  const lang = searchParams.get('lang') ?? ''
  const featuredOnly = searchParams.get('featured') === '1'
  const rawSort = searchParams.get('sort')
  const sort: SortKey = rawSort === 'stars' || rawSort === 'updated' || rawSort === 'name' ? rawSort : 'stars'
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const update = useCallback(
    (patch: Record<string, string | null>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k)
          else next.set(k, v)
        }
        if (resetPage) next.delete('page')
        return next
      })
    },
    [setSearchParams],
  )

  // ---- 搜索防抖 ----
  const [input, setInput] = useState(q)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const t = window.setTimeout(() => update({ q: input }), 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  const plugins = state.status === 'ready' ? state.data.plugins : []
  const languages = useMemo(() => collectLanguages(plugins), [plugins])

  /** 精选插件（按 Star 降序，用于「只看精选」计数） */
  const featuredPlugins = useMemo(
    () => plugins.filter((p) => p.featured).sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name)),
    [plugins],
  )

  const filtered = useMemo(
    () =>
      filterPlugins(plugins, {
        q,
        categories: cats,
        types,
        language: lang,
        sort,
        featuredOnly,
      }),
    [plugins, q, cats, types, lang, sort, featuredOnly],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  )

  const stats = useMemo(() => {
    const pluginCount = plugins.filter((p) => PLUGIN_TYPES.includes(p.type)).length
    const imageCount = plugins.reduce((n, p) => n + p.images.length, 0)
    return { pluginCount, imageCount }
  }, [plugins])

  if (state.status === 'loading') {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">正在加载插件数据…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16">
      {/* 头部信息 */}
      <div className="py-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          DeepSeek Harness 插件目录
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          收录 GitHub <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">dsh-plugin</code>{' '}
          topic 下的全部仓库（{state.data.total} 个），默认展示插件类，支持搜索、分类筛选与一键复制安装命令。
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Stat label="插件类" value={stats.pluginCount} />
          <Stat label="全部仓库" value={state.data.total} />
          <Stat label="已爬取图片" value={stats.imageCount} />
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            数据更新于 {new Date(state.data.crawledAt).toLocaleString('zh-CN', { hour12: false })}
          </span>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 fill-none stroke-gray-400"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="搜索插件：名称、作者、简介、标签、安装命令…"
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-gray-700 dark:bg-gray-900 dark:placeholder:text-gray-500"
          aria-label="搜索插件"
        />
      </div>

      {/* 筛选与排序 */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => update({ types: null })}
            className={`px-3 py-1.5 text-xs font-medium ${
              types !== null
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            仅插件
          </button>
          <button
            type="button"
            onClick={() => update({ types: 'all' })}
            className={`px-3 py-1.5 text-xs font-medium ${
              types === null
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            全部类型
          </button>
        </div>

        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand dark:border-gray-700 dark:bg-gray-900"
          aria-label="排序"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              排序：{s.label}
            </option>
          ))}
        </select>

        <select
          value={lang}
          onChange={(e) => update({ lang: e.target.value })}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand dark:border-gray-700 dark:bg-gray-900"
          aria-label="按语言筛选"
        >
          <option value="">语言：全部</option>
          {languages.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}（{l.count}）
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} 个结果
        </span>
      </div>

      {/* 分类 chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => update({ featured: featuredOnly ? null : '1' })}
          aria-pressed={featuredOnly}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            featuredOnly
              ? 'bg-amber-400 font-semibold text-amber-950'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          ⭐ 只看精选{featuredOnly ? `（${featuredPlugins.length}）` : ''}
        </button>
        <button
          type="button"
          onClick={() => update({ cat: null })}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            cats.length === 0
              ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          全部分类
        </button>
        {CATEGORIES.map((c) => {
          const active = cats.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                const next = active ? cats.filter((x) => x !== c.id) : [...cats, c.id]
                update({ cat: next.length ? next.join(',') : null })
              }}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                active
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      {/* 卡片网格 */}
      {pageItems.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">没有找到匹配的插件，换个关键词或筛选条件试试。</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((p) => (
              <PluginCard key={p.id} plugin={p} />
            ))}
          </div>
          <div className="mt-8">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onChange={(p) => update({ page: String(p) }, false)}
            />
          </div>
        </>
      )}

      {/* 分类图例（说明） */}
      <div className="mt-12 border-t border-gray-200 pt-4 text-[11px] leading-5 text-gray-400 dark:border-gray-800 dark:text-gray-600">
        分类说明：{CATEGORIES.map((c) => `${c.label}（${CATEGORY_LABEL[c.id]}）`).join(' · ')}。分类由仓库主题与描述自动推断，仅供参考。
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      <b className="text-brand dark:text-brand-light">{value}</b>
      {label}
    </span>
  )
}
