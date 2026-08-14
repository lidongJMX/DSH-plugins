/**
 * DSH 插件中心 · 数据爬虫
 *
 * 数据源（无需 GITHUB_TOKEN 也可运行）：
 *   1. GitHub Search API  q=topic:dsh-plugin （未鉴权 10 次/分，分页约 10 页）
 *   2. raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>  （HEAD 伪引用 = 默认分支，免 API 限流）
 *
 * 产出：
 *   public/data/plugins.json       前端消费的最终数据集
 *   public/plugins/<owner>/<repo>/ 下载到本地的插件图片
 *   data/repos.json                原始仓库列表缓存
 *   data/readmes/                  每仓库 README 缓存（增量跳过）
 *   data/package-jsons/            每仓库 package.json 缓存
 *
 * 用法：
 *   node scripts/crawl.mjs         增量运行（跳过已有缓存与已下载图片）
 *   node scripts/crawl.mjs --force 强制全量重爬
 *   GITHUB_TOKEN=xxx node scripts/crawl.mjs   （可选，提升 Search API 限流）
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'data')
const README_DIR = join(DATA_DIR, 'readmes')
const PKG_DIR = join(DATA_DIR, 'package-jsons')
const IMG_DIR = join(ROOT, 'public', 'plugins')
const OUT_DIR = join(ROOT, 'public', 'data')

const TOKEN = process.env.GITHUB_TOKEN ?? ''
const FORCE = process.argv.includes('--force')
// CI 定时刷新：强制重拉仓库列表（抓新插件/更新 Star），但 README/图片仍走缓存增量
const FORCE_REPOS = process.env.FORCE_REPOS === '1'
const UA = { 'User-Agent': 'dsh-plugin-hub-crawler' }

// ---------------------------------------------------------------- 工具函数

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function authHeaders() {
  return TOKEN ? { ...UA, Authorization: `token ${TOKEN}` } : { ...UA }
}

/** 通用 fetch：20s 超时 + 网络错误重试 + 429/5xx 退避；403 一律按限流等待 Retry-After（raw 用短退避） */
async function fetchRetry(url, headers, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 4
  let delay = opts.baseDelay ?? 1500
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res
    try {
      res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(opts.timeout ?? 20_000) })
    } catch (e) {
      // 网络层错误（超时/断连），退避重试
      if (attempt === maxAttempts) throw e
      await sleep(delay)
      delay *= 2
      continue
    }
    if (res.status === 200 || res.status === 404) return res
    if (res.status === 403) {
      if (opts.raw) {
        // raw CDN 限流温和，短退避重试
        const retryAfter = Number(res.headers.get('retry-after') ?? '')
        await sleep(retryAfter > 0 ? retryAfter * 1000 : delay)
        delay *= 2
        continue
      }
      // API 403 = 限流：未鉴权 60 次/时、Search API 带 token 也仅 30 次/分
      const retryAfter = Number(res.headers.get('retry-after') ?? '')
      const wait = retryAfter > 0 ? retryAfter * 1000 : 60_000
      process.stderr.write(`  [rate-limit] wait ${Math.round(wait / 1000)}s (403)\n`)
      await sleep(wait)
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '')
      const wait = retryAfter > 0 ? retryAfter * 1000 : delay
      await sleep(wait)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`fetch failed after retries: ${url}`)
}

/** 全局 Search API 节流：带 token 30 次/分 → 2.5s 间隔；无 token 10 次/分 → 7s 间隔 */
const SEARCH_INTERVAL = TOKEN ? 2500 : 7000
let lastSearchAt = 0
async function searchThrottle() {
  const now = Date.now()
  const wait = SEARCH_INTERVAL - (now - lastSearchAt)
  if (wait > 0) await sleep(wait)
  lastSearchAt = Date.now()
}

/** 从 raw.githubusercontent.com 取文件（404 → null） */
async function rawGet(owner, repo, path) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`
  const res = await fetchRetry(url, UA, { raw: true })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`raw ${res.status}: ${url}`)
  return res.text()
}

// ---------------------------------------------------------------- 1. 仓库发现

async function fetchTopicRepos() {
  const cacheFile = join(DATA_DIR, 'repos.json')
  const cacheStamp = join(DATA_DIR, 'repos.meta.json')
  if (!FORCE && !FORCE_REPOS && existsSync(cacheFile) && existsSync(cacheStamp)) {
    const meta = JSON.parse(readFileSync(cacheStamp, 'utf8'))
    const ageDays = (Date.now() - meta.fetchedAt) / 86_400_000
    if (ageDays < 7) {
      console.log(`[repos] 使用缓存（${meta.count} 个仓库，${Math.round(ageDays)} 天前抓取）`)
      return JSON.parse(readFileSync(cacheFile, 'utf8'))
    }
    console.log('[repos] 缓存超过 7 天，重新拉取')
  }

  // GitHub Search API 单次查询最多返回 1000 条（超出翻页返回 422）。
  // 总数 > 1000 时，按创建时间把查询拆成多个窗口（各窗口独立受 1000 上限），
  // 最后按 full_name 去重合并 —— 这是 Search API 上限的标准解法。
  const MIN_DATE = '2015-01-01'

  async function searchWindow(query, opts = {}) {
    const items = []
    let page = 1
    let total = 0
    for (;;) {
      await searchThrottle() // 全局限速：Search API 30 次/分（token）或 10 次/分（无 token）
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=100&page=${page}`
      const res = await fetchRetry(url, authHeaders())
      if (!res.ok) throw new Error(`search API ${res.status}: ${url}`)
      const data = await res.json()
      total = data.total_count
      items.push(...data.items)
      console.log(`  [search] ${query}  page ${page}: +${data.items.length} (${items.length}/${total})`)
      // Search API 单查询硬上限 1000 条：达到即停，不能翻到第 11 页（会 422）
      if (opts.probe || data.items.length < 100 || items.length >= 1000 || items.length >= total) break
      page++
    }
    return { items, total }
  }

  function midDate(from, to) {
    const f = new Date(`${from}T00:00:00Z`).getTime()
    const t = new Date(`${to}T00:00:00Z`).getTime()
    return new Date(f + Math.floor((t - f) / 2)).toISOString().slice(0, 10)
  }

  const seen = new Map()
  async function collectWindow(query, from, to, depth = 0) {
    // 先探测第一页拿 total_count：窗口 ≤1000 才全量下载，否则按创建时间二分
    const probe = await searchWindow(query, { probe: true })
    if (probe.total <= 1000) {
      const { items } = await searchWindow(query)
      for (const it of items) seen.set(it.full_name, it)
      return
    }
    if (from >= to || depth >= 12) {
      for (const it of probe.items) seen.set(it.full_name, it) // 兜底：单日窗口仍超限则取前 1000
      return
    }
    const mid = midDate(from, to)
    console.log(`  [search] 窗口 ${from}..${to} 有 ${probe.total} 条（>1000），按创建时间拆分`)
    await collectWindow(`topic:dsh-plugin created:${from}..${mid}`, from, mid, depth + 1)
    await collectWindow(`topic:dsh-plugin created:${mid}..${to}`, mid, to, depth + 1)
  }

  const top = await searchWindow('topic:dsh-plugin')
  for (const it of top.items) seen.set(it.full_name, it)
  if (top.total > 1000) {
    const today = new Date().toISOString().slice(0, 10)
    console.log(`[repos] 总数 ${top.total} 超过 1000 上限，按创建时间窗口补齐（当前 ${seen.size} 个）`)
    await collectWindow(`topic:dsh-plugin created:${MIN_DATE}..${today}`, MIN_DATE, today)
  }
  const all = [...seen.values()]
  console.log(`[repos] 去重合并后：${all.length} 个仓库`)
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(all, null, 1))
  writeFileSync(cacheStamp, JSON.stringify({ fetchedAt: Date.now(), count: all.length }))
  console.log(`[repos] 完成：共 ${all.length} 个仓库`)
  return all
}

// ---------------------------------------------------------------- 2. README / package.json

function cachePath(dir, owner, repo, ext) {
  return join(dir, `${owner}__${repo}${ext}`)
}

async function fetchReadme(repo) {
  const file = cachePath(README_DIR, repo.owner.login, repo.name, '.md')
  if (!FORCE && existsSync(file)) return readFileSync(file, 'utf8')
  const text = await rawGet(repo.owner.login, repo.name, 'README.md')
  if (text === null) {
    // 部分仓库只有 README.zh-CN.md / README_EN.md，作为备选
    const alt = await rawGet(repo.owner.login, repo.name, 'README.zh-CN.md')
    if (alt !== null) {
      mkdirSync(README_DIR, { recursive: true })
      writeFileSync(file, alt)
      return alt
    }
    mkdirSync(README_DIR, { recursive: true })
    writeFileSync(file, '')
    return ''
  }
  mkdirSync(README_DIR, { recursive: true })
  writeFileSync(file, text)
  return text
}

async function fetchPackageJson(repo) {
  const file = cachePath(PKG_DIR, repo.owner.login, repo.name, '.json')
  if (!FORCE && existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }
  const text = await rawGet(repo.owner.login, repo.name, 'package.json')
  mkdirSync(PKG_DIR, { recursive: true })
  let pkg = null
  if (text !== null) {
    try {
      pkg = JSON.parse(text)
    } catch {
      pkg = null
    }
  }
  writeFileSync(file, JSON.stringify(pkg ?? { __missing: true }))
  return pkg
}

// ---------------------------------------------------------------- 3. 安装命令提取

const INSTALL_PATTERNS = [
  // 1. npx -y @deepseek-ai/dsh plugin ... add <spec>
  /npx\s+-y\s+@deepseek-ai\/dsh\s+plugin\s+--profile\s+\S+\s+add\s+(\S+)/,
  // 2. dsh plugin --profile <p> add <spec>
  /dsh\s+plugin\s+--profile\s+\S+\s+add\s+(\S+)/,
  // 3. curl ... | bash / irm ... | iex
  /(?:curl\s+-fsSL\s+(\S+)\s*\|\s*bash|irm\s+(\S+)\s*\|\s*iex)/,
]

function stripAnsiLike(s) {
  return s.replace(/[`"'$]/g, '').replace(/[,.;:，。；：、）)」】]+$/, '').trim()
}

function extractInstall(readme, fullName) {
  const fallback = { command: `dsh plugin --profile web add github:${fullName}`, steps: extractSteps(readme), source: 'fallback' }
  if (!readme) {
    return { command: fallback.command, steps: [], source: 'fallback' }
  }
  const blocks = [...readme.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1])

  // 1) 最高优先级：DSH 专属命令（npx -y @deepseek-ai/dsh / dsh plugin add）
  //    先在全文找（很多 README 把它写在行内代码而非代码块里），再找代码块
  for (const hay of [readme, ...blocks]) {
    for (const pattern of [INSTALL_PATTERNS[0], INSTALL_PATTERNS[1]]) {
      const m = hay.match(pattern)
      if (m) {
        return {
          command: `dsh plugin --profile web add ${stripAnsiLike(m[1])}`,
          steps: extractSteps(readme),
          source: 'readme',
        }
      }
    }
  }

  // 2) 次优：同仓库一键安装脚本（curl | bash / irm | iex），仅接受 GitHub 域名，避免误抓前置依赖
  const curlMatch = (hay) => hay.match(INSTALL_PATTERNS[2])
  for (const hay of blocks) {
    const m = curlMatch(hay)
    if (m && /github\.com|githubusercontent/.test(m[1] ?? m[2])) {
      const spec = m[1] ?? m[2]
      return {
        command: m[0].includes('curl') ? `curl -fsSL ${spec} | bash` : `irm ${spec} | iex`,
        steps: extractSteps(readme),
        source: 'readme',
      }
    }
  }
  const mFull = curlMatch(readme)
  if (mFull && /github\.com|githubusercontent/.test(mFull[1] ?? mFull[2])) {
    const spec = mFull[1] ?? mFull[2]
    return {
      command: mFull[0].includes('curl') ? `curl -fsSL ${spec} | bash` : `irm ${spec} | iex`,
      steps: extractSteps(readme),
      source: 'readme',
    }
  }

  return fallback
}

function extractSteps(readme) {
  if (!readme) return []
  const steps = []
  const section = readme.match(/(?:安装|Install|Installation|安装方式|🚀 安装|安装步骤)[^\n]*\n([\s\S]{0,1600})/i)
  if (section) {
    const body = section[1]
    const lines = body.split('\n').slice(0, 40)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('```') || /^#{1,6}\s/.test(trimmed) || /^!\[/.test(trimmed)) continue
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+[.、]/.test(trimmed)) {
        const text = trimmed
          .replace(/^[-*]\s*/, '')
          .replace(/^\d+[.、]\s*/, '')
          .replace(/[`*_]/g, '')
          .trim()
        if (text.length > 8 && text.length <= 140) steps.push(text)
        if (steps.length >= 4) break
      }
    }
  }
  if (steps.length === 0) {
    const restart = readme.match(/(?:重启|restart|硬刷新|重新加载)[^。\n]{0,40}/i)
    if (restart) steps.push(restart[0].trim())
  }
  return steps
}

// ---------------------------------------------------------------- 4. 图片提取与下载

const SKIP_HOST = /(img\.shields\.io|shields\.io|badgen\.net|giphy\.com|gph\.is|youtube\.com|youtu\.be|ytimg\.com|github-readme-stats|ghchart|visitor-badge|star-history|wakatime\.com|opengraph\.githubassets\.com)/i
const IMG_EXT = /\.(png|jpe?g|webp|gif)(\?.*)?$/i

function collectImageUrls(readme, owner, repo) {
  if (!readme) return []
  const items = [] // { url, alt }
  const push = (u, alt = '') => {
    const clean = u.replace(/\)$/, '').trim()
    if (!clean || clean.length > 500 || SKIP_HOST.test(clean)) return
    items.push({ url: clean, alt: alt.trim().slice(0, 120) })
  }
  // markdown ![](url)
  for (const m of readme.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) push(m[2], m[1])
  // html <img src="...">
  for (const m of readme.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(m[1])
  // 裸 user-attachments 链接（无扩展名，下载时按 Content-Type 定扩展名）
  for (const m of readme.matchAll(/https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/gi)) push(m[0])
  const resolved = []
  const seen = new Set()
  for (const { url, alt } of items) {
    let final = url
    if (!/^https?:\/\//.test(url)) {
      const p = url.replace(/^\.\/?/, '').replace(/^\//, '')
      final = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${encodeURI(p)}`
    }
    if (seen.has(final)) continue
    seen.add(final)
    // 排除明显非图片（徽章域名已过滤；再按扩展名或 user-attachments 判定）
    if (!/user-attachments/.test(final) && !IMG_EXT.test(final)) continue
    resolved.push({ url: final, alt })
  }
  return resolved.slice(0, 8) // 上限 8，后面再截断到 6
}

const IMG_CONTENT_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

async function downloadImage(url, destDir, index) {
  // 能提前判断扩展名时，先命中本地缓存
  const urlExt = extname(url).match(/\.(png|jpe?g|webp|gif)$/i)?.[0].replace('.', '').toLowerCase() ?? null
  if (urlExt) {
    const candidate = `img-${index}.${urlExt}`
    if (!FORCE && existsSync(join(destDir, candidate))) return candidate
  }
  // 大截图可能很慢（user-attachments / raw 大图），给 45s 超时
  const res = await fetchRetry(url, UA, { maxAttempts: 4, baseDelay: 800, raw: true, timeout: 45_000 })
  if (!res.ok) return null
  const ctype = res.headers.get('content-type') ?? ''
  const ext = urlExt ?? IMG_CONTENT_TYPE[ctype.split(';')[0].trim().toLowerCase()] ?? null
  if (!ext) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 2.5 * 1024 * 1024) return null // 单图 > 2.5MB 跳过
  if (buf.length < 300) return null // 过小多半是占位
  const name = `img-${index}.${ext}`
  writeFileSync(join(destDir, name), buf)
  return name
}

async function processImages(repo, readme) {
  // 图片结果印记：处理过的仓库（含失败的）落 stamp，增量运行直接复用，
  // 避免每次都重试下载失败的大图（如 user-attachments 403）。--force 才重处理。
  const stamp = join(DATA_DIR, 'image-stamps', `${repo.owner.login}__${repo.name}.json`)
  if (!FORCE && existsSync(stamp)) {
    return JSON.parse(readFileSync(stamp, 'utf8'))
  }
  const urls = collectImageUrls(readme, repo.owner.login, repo.name)
  if (urls.length === 0) {
    mkdirSync(dirname(stamp), { recursive: true })
    writeFileSync(stamp, '[]')
    return []
  }
  const destDir = join(IMG_DIR, repo.owner.login, repo.name)
  mkdirSync(destDir, { recursive: true })
  const images = []
  let index = 0
  for (const { url, alt } of urls) {
    if (images.length >= 6) break
    try {
      const name = await downloadImage(url, destDir, index)
      if (name) {
        images.push({ file: name, alt })
        index++
      }
    } catch {
      // 单张图片失败（超时/断连）不影响整个仓库
    }
  }
  mkdirSync(dirname(stamp), { recursive: true })
  writeFileSync(stamp, JSON.stringify(images))
  return images
}

// ---------------------------------------------------------------- 5. 类型 / 分类推断

function inferType(repo, pkg, readme) {
  const name = repo.name
  const desc = repo.description ?? ''
  const blob = `${name} ${desc}`
  if (repo.full_name === 'deepseek-ai/deepseek-harness') return 'core'
  if (pkg?.dsh?.bundle) return 'bundle'
  if (/awesome|精选|curated|榜单|资源列表|插件列表/i.test(blob)) return 'list'
  if (/(教程|tutorial|handbook|指南|guide|手册|从零|零基础|踩坑|档案)/i.test(blob)) return 'tutorial'
  if (/(desktop|electron|客户端|桌面|launcher|打包|shell for)/i.test(blob)) return 'shell'
  if (readme && /(dsh plugin|dsh-plugin|\.dsh-plugin|dsh --profile|dsh plugin)/i.test(readme)) return 'repo-plugin'
  if (/plugin|插件|harness/i.test(blob)) return 'repo-plugin'
  return 'other'
}

const CATEGORY_RULES = [
  { id: 'vision', label: '视觉', re: /vision|视觉|看图|图像|image|ocr|screenshot|截图|modlens|图片/i },
  { id: 'ui', label: '侧边栏与 UI', re: /sidebar|side-panel|侧边栏|panel|面板|web-ui|genui|visualize|ui-|工作台/i },
  { id: 'tui', label: '终端 TUI', re: /tui|终端|terminal|命令[行线]/i },
  { id: 'desktop', label: '桌面客户端', re: /desktop|electron|桌面|launcher|客户端/i },
  { id: 'toolkit', label: '工具集', re: /toolkit|工具包|工具|utils|automation|自动化|插件开发/i },
  { id: 'memory', label: '记忆与状态', re: /memory|记忆|memo|evolve|状态|回退|rewind/i },
  { id: 'workflow', label: '工作流', re: /workflow|工作流|orchestrat|调度|schedule|定时/i },
  { id: 'skin', label: '皮肤与外观', re: /skin|theme|皮肤|外观|whale|鲸鱼|pet|宠物|娘|广告/i },
  { id: 'game', label: '游戏与娱乐', re: /game|游戏|minigame|摸鱼/i },
  { id: 'web', label: '搜索与网络', re: /search|搜索|fetch|browser|浏览器|chrome|网络|分享/i },
  { id: 'docs', label: '教程与资源', re: /教程|tutorial|handbook|指南|guide|awesome|精选|资源|手册/i },
  { id: 'other', label: '其他', re: /.*/ },
]

/** 知名仓库的强制分类覆盖（人工校正启发式误判） */
const CATEGORY_OVERRIDES = {
  'liustack/modlens': 'vision',
  'Anionex/dsh-vision-toolkit': 'vision',
  'william-jin-cmu/dsh-vision': 'vision',
  'ysr666/dsh-vision-router': 'vision',
  'ccch1mneyyy/dsh-TUI': 'tui',
  'huiliyi37/dsh-tianshu-tui': 'tui',
  'zhu1090093659/dsh-web-ui': 'ui',
  'omdsh-dev/DSH-better-sidebar': 'ui',
  'ccq1/dsh-side-panel': 'ui',
  'Nagi-ovo/dsh-visualize': 'ui',
  'omdsh-dev/dsh-genui': 'ui',
  'Lum1104/dsh-browser': 'web',
  'liustack/modsearch': 'web',
  'taxueseek/argo': 'web',
  'Small-tailqwq/dsh-deep-whale': 'skin',
  'lhh010/dsh-ui-whale': 'skin',
  'alingalingling/ui-status-label': 'skin',
  'lhh010/dsh-minigames': 'game',
  'Nagi-ovo/dsh-ads': 'skin',
}

function inferCategory(repo, type) {
  const override = CATEGORY_OVERRIDES[repo.full_name]
  if (override) return override
  const blob = `${repo.name} ${repo.description ?? ''} ${(repo.topics ?? []).join(' ')}`
  if (type === 'tutorial' || type === 'list') {
    if (/dsh|harness/i.test(blob)) return 'docs'
  }
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(blob)) return rule.id
  }
  return 'other'
}

// ---------------------------------------------------------------- 6. 简介提取

function extractIntro(repo, readme) {
  const desc = (repo.description ?? '').trim()
  if (desc) return desc.slice(0, 260)
  if (!readme) return ''
  const lines = readme.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const prose = []
  for (const line of lines) {
    if (line.startsWith('#')) continue
    if (line.startsWith('![') || line.startsWith('<') || line.startsWith('```')) continue
    if (/img\.shields|badge/i.test(line)) continue
    if (/^[-*_=\s]+$/.test(line)) continue
    const clean = line.replace(/[`*_>#]/g, '').trim()
    if (clean.length > 12) prose.push(clean)
    if (prose.length >= 2) break
  }
  return prose.join(' ').slice(0, 260)
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const t0 = Date.now()
  mkdirSync(OUT_DIR, { recursive: true })
  mkdirSync(IMG_DIR, { recursive: true })

  const repos = await fetchTopicRepos()

  // --repos-only：只刷新仓库列表并退出（便于快速验证 / 定时更新列表）
  if (process.argv.includes('--repos-only')) {
    console.log(`[repos-only] 完成：${repos.length} 个仓库，用时 ${Math.round((Date.now() - t0) / 1000)}s`)
    return
  }

  const plugins = []
  let done = 0
  let imagesTotal = 0
  const seenErrors = new Map()

  const CONCURRENCY = 32
  let cursor = 0
  async function worker() {
    for (;;) {
      const i = cursor++
      if (i >= repos.length) return
      const repo = repos[i]
      const id = `${repo.owner.login}/${repo.name}`
      try {
        // README 与 package.json 并行抓取
        const [readme, pkg] = await Promise.all([fetchReadme(repo), fetchPackageJson(repo)])
        const type = inferType(repo, pkg, readme)
        const images = await processImages(repo, readme)
        imagesTotal += images.length
        const install = extractInstall(readme, id)
        plugins.push({
          id,
          name: repo.name,
          owner: repo.owner.login,
          fullName: id,
          repoUrl: repo.html_url,
          homepage: repo.homepage ?? null,
          description: repo.description ?? '',
          intro: extractIntro(repo, readme),
          language: repo.language ?? null,
          license: repo.license?.spdx_id ?? null,
          topics: repo.topics ?? [],
          stars: repo.stargazers_count ?? 0,
          forks: repo.forks_count ?? 0,
          createdAt: repo.created_at ?? '',
          updatedAt: repo.pushed_at ?? repo.updated_at ?? '',
          category: inferCategory(repo, type),
          type,
          install,
          images: images.map((im) => ({ file: im.file, alt: im.alt })),
        })
      } catch (e) {
        seenErrors.set(id, e.message)
        plugins.push({
          id,
          name: repo.name,
          owner: repo.owner.login,
          fullName: id,
          repoUrl: repo.html_url,
          homepage: repo.homepage ?? null,
          description: repo.description ?? '',
          intro: repo.description ?? '',
          language: repo.language ?? null,
          license: repo.license?.spdx_id ?? null,
          topics: repo.topics ?? [],
          stars: repo.stargazers_count ?? 0,
          forks: repo.forks_count ?? 0,
          createdAt: repo.created_at ?? '',
          updatedAt: repo.pushed_at ?? repo.updated_at ?? '',
          category: 'other',
          type: 'other',
          install: { command: `dsh plugin --profile web add github:${id}`, steps: [], source: 'fallback' },
          images: [],
        })
      }
      done++
      if (done % 25 === 0 || done === repos.length) {
        const elapsed = (Date.now() - t0) / 1000
        const rate = (done / elapsed).toFixed(1)
        console.log(`[crawl] ${done}/${repos.length}  (${rate}/s, 图片 ${imagesTotal}, 耗时 ${Math.round(elapsed)}s)`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  plugins.sort((a, b) => b.stars - a.stars)
  const payload = {
    crawledAt: new Date().toISOString(),
    total: plugins.length,
    plugins,
  }
  writeFileSync(join(OUT_DIR, 'plugins.json'), JSON.stringify(payload))
  console.log('')
  console.log('===== 抓取完成 =====')
  console.log(`仓库总数   : ${plugins.length}`)
  console.log(`下载图片   : ${imagesTotal}`)
  console.log(`耗时       : ${Math.round((Date.now() - t0) / 1000)}s`)
  if (seenErrors.size > 0) {
    console.log(`部分失败   : ${seenErrors.size}`)
    for (const [id, msg] of [...seenErrors.entries()].slice(0, 10)) console.log(`  - ${id}: ${msg}`)
  }
  const byType = {}
  const byCat = {}
  for (const p of plugins) {
    byType[p.type] = (byType[p.type] ?? 0) + 1
    byCat[p.category] = (byCat[p.category] ?? 0) + 1
  }
  console.log('类型分布   :', JSON.stringify(byType))
  console.log('分类分布   :', JSON.stringify(byCat))
  console.log(`输出       : ${join(OUT_DIR, 'plugins.json')}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
