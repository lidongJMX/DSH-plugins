import type { Plugin } from './types'

/** 自动精选：每个分类按 Star 取前 N 名 */
export const FEATURED_PER_CATEGORY = 3
/** 自动精选的最低 Star 门槛（避免低质仓库进入精选） */
export const FEATURED_MIN_STARS = 50

export interface FeaturedInclude {
  fullName: string
  /** 展示用推荐语（可选，手动精选时建议填写） */
  reason?: string
}

export interface FeaturedConfig {
  /** 手动强制入选的插件 */
  include: FeaturedInclude[]
  /** 从精选移除的插件（覆盖自动与手动） */
  exclude: string[]
}

export const EMPTY_FEATURED: FeaturedConfig = { include: [], exclude: [] }

/** 读取手动精选配置；文件缺失或损坏时回退为空配置（纯自动规则） */
export async function fetchFeaturedConfig(base: string): Promise<FeaturedConfig> {
  try {
    const res = await fetch(`${base}data/featured.json`, { cache: 'no-cache' })
    if (!res.ok) return EMPTY_FEATURED
    const raw = (await res.json()) as Partial<FeaturedConfig>
    return {
      include: Array.isArray(raw.include)
        ? raw.include.filter((i) => i && typeof i.fullName === 'string').map((i) => ({ fullName: i.fullName, reason: i.reason }))
        : [],
      exclude: Array.isArray(raw.exclude) ? raw.exclude.filter((x) => typeof x === 'string') : [],
    }
  } catch {
    return EMPTY_FEATURED
  }
}

/**
 * 计算精选并注入到插件对象（返回新数组，不修改入参）。
 * 规则：手动 include 强制入选（带推荐语）；exclude 一律移除；
 * 其余按「每分类 Star 前 FEATURED_PER_CATEGORY 名、且 ≥ FEATURED_MIN_STARS」自动入选。
 */
export function applyFeatured(plugins: Plugin[], config: FeaturedConfig): Plugin[] {
  const excludeSet = new Set(config.exclude)
  const manual = new Map(config.include.map((i) => [i.fullName.toLowerCase(), i.reason ?? '']))

  // 自动精选：按分类分组取 Star 前列
  const byCategory = new Map<string, Plugin[]>()
  for (const p of plugins) {
    if (excludeSet.has(p.fullName.toLowerCase())) continue
    const list = byCategory.get(p.category)
    if (list) list.push(p)
    else byCategory.set(p.category, [p])
  }

  const auto = new Set<string>()
  for (const list of byCategory.values()) {
    list
      .filter((p) => p.stars >= FEATURED_MIN_STARS)
      .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
      .slice(0, FEATURED_PER_CATEGORY)
      .forEach((p) => auto.add(p.fullName.toLowerCase()))
  }

  return plugins.map((p) => {
    const key = p.fullName.toLowerCase()
    const reason = manual.get(key)
    const featured = !excludeSet.has(key) && (reason !== undefined || auto.has(key))
    if (!featured) return p
    return { ...p, featured: true, featuredReason: reason || undefined }
  })
}
