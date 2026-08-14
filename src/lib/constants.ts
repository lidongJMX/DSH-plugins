import type { PluginType } from './types'

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'vision', label: '视觉' },
  { id: 'tui', label: '终端 TUI' },
  { id: 'ui', label: '侧边栏与 UI' },
  { id: 'desktop', label: '桌面客户端' },
  { id: 'toolkit', label: '工具集' },
  { id: 'memory', label: '记忆与状态' },
  { id: 'workflow', label: '工作流' },
  { id: 'skin', label: '皮肤与外观' },
  { id: 'game', label: '游戏与娱乐' },
  { id: 'web', label: '搜索与网络' },
  { id: 'docs', label: '教程与资源' },
  { id: 'other', label: '其他' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
)

export const TYPE_META: Record<PluginType, { label: string; className: string }> = {
  bundle: {
    label: '原生 bundle',
    className: 'bg-brand text-white',
  },
  'repo-plugin': {
    label: '仓库插件',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  },
  list: {
    label: '精选列表',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
  tutorial: {
    label: '教程',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  shell: {
    label: '桌面客户端',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  },
  core: {
    label: '核心',
    className: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  },
  other: {
    label: '其他',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
}

/** 默认只展示这些「插件」类型（用户确认：全收录但默认只看插件） */
export const PLUGIN_TYPES: PluginType[] = ['bundle', 'repo-plugin']

export const SORTS = [
  { id: 'stars', label: '最多 Star' },
  { id: 'updated', label: '最近更新' },
  { id: 'name', label: '名称 A–Z' },
] as const

export type SortKey = (typeof SORTS)[number]['id']

export const PAGE_SIZE = 24
