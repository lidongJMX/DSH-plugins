import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PluginData } from '../lib/types'
import { CATEGORY_LABEL, TYPE_META } from '../lib/constants'
import { formatDate, formatStars, loadPlugins } from '../lib/store'
import Badge from '../components/Badge'
import CopyButton from '../components/CopyButton'
import ImageGallery from '../components/ImageGallery'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: PluginData }

export default function DetailPage() {
  const { owner, name } = useParams<{ owner: string; name: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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

  const plugin = useMemo(() => {
    if (state.status !== 'ready' || !owner || !name) return null
    return state.data.plugins.find((p) => p.owner === owner && p.name === name) ?? null
  }, [state, owner, name])

  if (state.status === 'loading') {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">正在加载…</p>
      </main>
    )
  }
  if (state.status === 'error') {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
      </main>
    )
  }
  if (!plugin) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">未找到该插件。</p>
        <Link to="/" className="mt-2 inline-block text-sm text-brand hover:underline dark:text-brand-light">
          ← 返回列表
        </Link>
      </main>
    )
  }

  const typeMeta = TYPE_META[plugin.type]
  const installSourceNote =
    plugin.install.source === 'readme'
      ? '来自项目 README 的安装说明'
      : '未在 README 中找到安装命令，以下为按 DSH 规范自动生成的通用命令'

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand dark:text-gray-400 dark:hover:text-brand-light"
      >
        <span aria-hidden="true">←</span> 返回列表
      </Link>

      {/* 头部 */}
      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-xl font-bold text-white">
            {plugin.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold sm:text-2xl">{plugin.name}</h1>
              <Badge className={typeMeta.className}>{typeMeta.label}</Badge>
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {CATEGORY_LABEL[plugin.category] ?? plugin.category}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-gray-400 dark:text-gray-500">{plugin.fullName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={plugin.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              GitHub
            </a>
            {plugin.homepage && (
              <a
                href={plugin.homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                主页 ↗
              </a>
            )}
          </div>
        </div>

        {plugin.intro && (
          <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{plugin.intro}</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-4">
          <Meta label="⭐ Star" value={formatStars(plugin.stars)} title={`${plugin.stars}`} />
          <Meta label="Fork" value={formatStars(plugin.forks)} title={`${plugin.forks}`} />
          <Meta label="语言" value={plugin.language ?? '—'} />
          <Meta label="License" value={plugin.license ?? '—'} />
          <Meta label="创建" value={formatDate(plugin.createdAt)} />
          <Meta label="最近更新" value={formatDate(plugin.updatedAt)} />
        </dl>
      </div>

      {/* 安装 */}
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M4 17h16M4 12h16M4 7h16" />
            </svg>
          </span>
          安装
        </h2>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {installSourceNote}。命令基于 DSH 的{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">dsh plugin</code>{' '}
          机制（<code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">web</code> 为默认 GUI 配置）。
        </p>
        <div className="mt-3 flex items-stretch gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-5 text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <code>{plugin.install.command}</code>
          </pre>
          <div className="flex items-center">
            <CopyButton text={plugin.install.command} className="h-full px-3 text-sm" />
          </div>
        </div>
        {plugin.install.steps.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {plugin.install.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-[11px] leading-4 text-gray-400 dark:text-gray-600">
          提示：安装后需重启 DSH 并刷新页面；不同插件可能有额外前置依赖（Node ≥ 20、pnpm ≥ 10 等），请以项目 README 为准。
        </p>
      </section>

      {/* 介绍 */}
      {plugin.description && plugin.description !== plugin.intro && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <h2 className="text-base font-semibold">介绍</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{plugin.description}</p>
        </section>
      )}

      {/* 截图 */}
      {plugin.images.length > 0 && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <ImageGallery plugin={plugin} images={plugin.images} />
        </section>
      )}

      {/* 标签 */}
      {plugin.topics.length > 0 && (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
          <h2 className="text-base font-semibold">标签</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plugin.topics.map((t) => (
              <span
                key={t}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                #{t}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950/60">
      <dt className="text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-gray-700 dark:text-gray-200" title={title ?? value}>
        {value}
      </dd>
    </div>
  )
}
