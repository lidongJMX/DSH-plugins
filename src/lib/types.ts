export interface PluginInstall {
  command: string
  steps: string[]
  source: 'readme' | 'fallback'
}

export interface PluginImage {
  file: string
  alt: string
}

export type PluginType =
  | 'bundle'
  | 'repo-plugin'
  | 'list'
  | 'tutorial'
  | 'shell'
  | 'core'
  | 'other'

export interface Plugin {
  id: string
  name: string
  owner: string
  fullName: string
  repoUrl: string
  homepage: string | null
  description: string
  intro: string
  language: string | null
  license: string | null
  topics: string[]
  stars: number
  forks: number
  createdAt: string
  updatedAt: string
  category: string
  type: PluginType
  install: PluginInstall
  images: PluginImage[]
}

export interface PluginData {
  crawledAt: string
  total: number
  plugins: Plugin[]
}
