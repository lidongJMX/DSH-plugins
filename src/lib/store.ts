import type { Plugin, PluginData } from './types'
import { CATEGORY_LABEL, TYPE_META, type SortKey } from './constants'

const base = import.meta.env.BASE_URL

let cache: Promise<PluginData> | null = null

async function doLoad(): Promise<PluginData> {
  const res = await fetch(`${base}data/plugins.json`, { cache: 'no-cache' })
  if (!res.ok) {
    throw new Error(`数据加载失败（HTTP ${res.status}）—— 请先运行 npm run crawl 生成数据`)
  }
  return (await res.json()) as PluginData
}

export function loadPlugins(): Promise<PluginData> {
  cache ??= doLoad().catch((e) => {
    // 失败后清空缓存，允许下次重试（例如爬虫数据尚未生成时）
    cache = null
    throw e
  })
  return cache
}

/** 插件图片的本地 URL */
export function imgUrl(p: Plugin, file: string): string {
  return `${base}plugins/${p.owner}/${p.name}/${file}`
}

export function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface Filters {
  q: string
  categories: string[] // 空 = 不限
  types: Plugin['type'][] | null // null = 全部类型
  language: string // '' = 不限
  sort: SortKey
}

export function filterPlugins(plugins: Plugin[], f: Filters): Plugin[] {
  const terms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const catSet = new Set(f.categories)
  const typeSet = f.types ? new Set(f.types) : null
  let out = plugins.filter((p) => {
    if (typeSet && !typeSet.has(p.type)) return false
    if (catSet.size > 0 && !catSet.has(p.category)) return false
    if (f.language && (p.language ?? '') !== f.language) return false
    if (terms.length > 0) {
      const hay = [
        p.name,
        p.owner,
        p.fullName,
        p.description,
        p.intro,
        p.language ?? '',
        p.topics.join(' '),
        p.install.command,
        CATEGORY_LABEL[p.category] ?? '',
        TYPE_META[p.type].label,
      ]
        .join(' ')
        .toLowerCase()
      if (!terms.every((t) => hay.includes(t))) return false
    }
    return true
  })
  switch (f.sort) {
    case 'stars':
      out = [...out].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
      break
    case 'updated':
      out = [...out].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      break
    case 'name':
      out = [...out].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      break
  }
  return out
}

/** 数据中出现的语言（按出现次数降序） */
export function collectLanguages(plugins: Plugin[]): { name: string; count: number }[] {
  const map = new Map<string, number>()
  for (const p of plugins) {
    if (!p.language) continue
    map.set(p.language, (map.get(p.language) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
