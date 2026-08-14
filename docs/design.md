# DSH 插件中心 · 设计方案

> 目标：做一个类似 [skillhub.cn/skills](https://www.skillhub.cn/skills?sortBy=score) 的中文社区站，
> 把 [github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin) 里的 DSH 插件全部列出来，
> 供用户搜索、筛选、排序，并查看每个插件的「简介 + 安装命令 + 截图」。

---

## 1. 产品定位

| 维度 | 说明 |
|---|---|
| 名称 | **DSH 插件中心**（DSH Plugin Hub） |
| 一句话 | 中文 DSH 插件的一站式发现、筛选、安装导航站 |
| 核心价值 | 把散落在 GitHub 上的 900+ 个 `dsh-plugin` 仓库，聚合成可搜索、可筛选、可一键复制安装命令的目录 |
| 目标用户 | DeepSeek Harness（DSH）使用者，以中文用户为主 |
| 定位差异 | 不是「精选 Top 50」，而是「全量目录 + 智能筛选」，解决「找不到/不会装」两个痛点 |

## 2. 参考站分析（skillhub.cn/skills）

skillhub 是一个腾讯托管的 SPA（Tea 框架，客户端渲染），核心能力：

1. **卡片列表**：每个 Skill 一张卡片（名称 + 一句话简介 + 分类/标签 + 评分）。
2. **搜索**：顶部关键词搜索。
3. **排序**：按 score（评分）/ 热度等排序（URL 体现 `?sortBy=score`）。
4. **分类筛选**：按类别筛选。
5. **详情页**：单个 Skill 的完整介绍。

**我们借鉴**：卡片式目录 + 搜索 + 排序 + 分类筛选 + 详情页的整体范式。
**我们不照搬**：skillhub 是「人工精选 Top 50 + 评分」，我们是「GitHub 全量 + 机器采集」；
因此我们的「评分」用 GitHub 真实指标（Stars / 最近更新 / 是否为原生 bundle）替代人工评分。

## 3. 信息架构（两个页面）

```
/                     列表页（首页）
  ├─ 顶部：Logo + 搜索框 + 插件总数 + 刷新时间
  ├─ 筛选栏：分类 / 类型 / 语言 / 排序（Stars·最近更新·名称）
  ├─ 卡片网格：插件卡片（可点击进详情）
  └─ 分页 / 无限滚动

/plugin/:owner/:repo  详情页
  ├─ 头部：名称 + 简介 + 元信息（Stars/Fork/语言/License/更新时间）+ 仓库链接
  ├─ 安装区：安装命令（一键复制）+ 安装步骤（若有）+ 备选安装方式
  ├─ 介绍区：插件介绍（精简，非全文）
  ├─ 截图区：图片画廊（爬取的图片）
  └─ 返回列表
```

## 4. 页面与组件设计

### 4.1 列表页

**顶部搜索栏**：站内全文搜索（名称/描述/标签/README 关键词），输入即筛，防抖 200ms。

**筛选区**（可折叠、移动端抽屉）：
- 分类（category）：视觉 / 终端 TUI / 侧边栏与 UI / 桌面客户端 / 工具集 / 记忆 / 工作流 / 皮肤 / 游戏 / 其他
- 类型（type）：原生插件（`dsh.bundle`）/ 仓库插件（.dsh-plugin）/ 精选列表 / 教程 / 桌面壳 —— 用于把 917 个仓库里非插件的项目区分开
- 语言（language）：TypeScript / JavaScript / Python / Rust / Go / …
- 排序：Stars（默认）· 最近更新 · 名称 A–Z

**插件卡片**（信息克制，符合「内容不要太多」）：
- 顶部：插件名 + 分类徽标 + 「原生 bundle」徽标（若有）
- 中间：一句话简介（截断 2 行）
- 底部：⭐ Stars · 语言色点 · 更新时间
- 快捷操作：悬浮「复制安装命令」按钮

**分页**：每页 24/48，URL 同步筛选参数（`?q=&cat=&sort=&page=`），可分享。

### 4.2 详情页

- **安装命令**为核心区：等宽字体代码块 + 「复制」按钮；主命令永远是一行可粘贴。
- **安装步骤**：当 README 中有多步安装（前置依赖 + 命令 + 重启提示）时，折叠展示前 3 步。
- **介绍**：2–4 段精简介绍（来自 README 首部/「为什么值得装」段落的提炼），不贴全文。
- **截图画廊**：爬取的图片，灯箱放大查看；无图则显示占位。
- **元信息**：Stars/Fork/语言/License/创建时间/最近更新时间/GitHub 链接。

## 5. 数据模型

```ts
interface Plugin {
  id: string              // "owner/repo"（唯一键）
  name: string            // 仓库名
  owner: string
  fullName: string        // owner/name
  repoUrl: string         // https://github.com/owner/name
  description: string     // GitHub 一句话描述（原始）
  intro: string           // 精简介绍（2~3 句，采集时提炼）
  homepage: string | null
  language: string | null
  license: string | null
  topics: string[]        // GitHub topics（含 dsh-plugin）
  stars: number
  forks: number
  createdAt: string
  updatedAt: string
  category: string        // 推断分类
  type: PluginType        // 'bundle' | 'repo-plugin' | 'list' | 'tutorial' | 'shell' | 'other'
  install: {
    command: string       // 一行可复制的安装命令
    steps: string[]       // 多步安装步骤（可选）
    source: 'readme' | 'fallback'
  }
  images: {
    url: string           // 本地托管后的相对路径
    alt: string
    isHero: boolean       // 首图（README 顶部大图）
  }[]
}
```

## 6. 数据采集（爬虫）方案

### 6.1 仓库发现
- 用 GitHub Search API `q=topic:dsh-plugin`，按 stars 降序，`per_page=100` 分页拉全量（当前 917 个，约 10 页）。
- 结果即含：full_name、description、topics、language、stars、forks、license、created/updated_at。
- **鉴权**：必须带 `GITHUB_TOKEN`（未鉴权 60 次/小时会立刻打满；带 token 5000 次/小时）。
- **缓存与增量**：整份 `repos.json` 落盘；重复爬取时按 `updatedAt` 跳过未变的仓库。

### 6.2 简介提取
- 优先用 GitHub 的 `description` 字段（一句话，天然简短）。
- 若无描述，取 README 首部 1–2 段非徽章、非图片的文本，截断到 ~200 字。
- 满足「内容不要太多」：卡片用 description，详情页用 `intro`。

### 6.3 安装命令提取（关键）
从 README 的代码块中识别，按优先级匹配：
1. `dsh plugin --profile web add <spec>` / `dsh plugin --profile <p> add <spec>`
2. `npx -y @deepseek-ai/dsh plugin --profile web add <spec>`
3. `curl -fsSL .../install.sh | bash` / `irm .../install.ps1 | iex`（脚本式安装）
4. 兜底：自动生成 `dsh plugin --profile web add github:<full_name>`

其中 `<spec>` 可能来自：npm 包名（`@scope/name@latest`）、`github:owner/repo[#ref]`。
`steps` 从「安装/Install/🚀 安装」标题下抽取前置依赖、重启提示等要点。

> 依据：DSH 源码 `apps/cli/src/plugin.ts` —— `dsh plugin` 是 pnpm 的转发器，
> `dsh plugin --profile <name> add <spec>` 即安装命令，`web` 是默认 GUI profile。

### 6.4 图片爬取
- 从 README 解析 `![alt](url)` 与裸 `user-attachments/assets/<id>` 链接。
- 相对路径（`screenshots/x.png`、`assets/x.jpg`）按仓库 raw 基址解析。
- **过滤噪声**：shields.io 徽章、`badge`/`shields` 域、SVG 徽章、深色 logo 占位。
- **只下载图片**（png/jpg/jpeg/webp/gif），跳过 mp4/视频（改为外链）。
- 下载到 `public/plugins/<owner>/<repo>/`，README 中的引用重写为本地路径。
- 限流：每仓库最多取 N 张（如 6 张），单图大小上限（如 2MB），并发受限。

### 6.5 分类 / 类型推断
- **type**（把非插件项目区分开）：
  - `bundle`：`package.json` 声明 `dsh.bundle`（拉 package.json 判定，一次请求/仓库）
  - `repo-plugin`：README 含 `.dsh-plugin` / `github:` 安装 / `dsh plugin add`
  - `list`：仓库名/描述含 `awesome`/「精选」/「榜单」
  - `tutorial`：含「教程」/`handbook`/`guide`
  - `shell`：桌面壳/客户端打包（Electron/desktop）
  - 其余 `other`
- **category**：由 topics + 描述关键词规则表推断（视觉/vision、TUI/终端、侧边栏、桌面、工具、记忆、工作流、皮肤、游戏……），另配手动覆盖表修正错判。

## 7. 技术架构（默认：纯静态站 + 构建期爬取）

```
GitHub API ──▶ 爬虫(Node/TS) ──▶ plugins.json + 下载图片
                                    │
                    Vite + React(SPA) 读静态数据
                                    │
                    任意静态托管（GH Pages / Vercel / 自托管）
```

- **前端**：Vite + React + TypeScript + Tailwind CSS + React Router。
- **数据**：构建期生成 `plugins.json`（一次生成，前端全量本地搜索/筛选，无需后端，无运行时限流）。
- **图片**：构建期下载，与静态资源同托管，避免外链失效与盗链。
- **定时刷新**：GitHub Action 每日/每周重跑爬虫重建站点（数据保鲜）。

**为什么不选全栈实时后端**：目录类站点数据低频变化，静态化可省服务器、省运行时 GitHub 限流、加载更快；需要实时性时再升级为「后端代理 + 缓存」即可，数据管道代码完全复用。

## 8. 视觉规范

- **风格**：参考 skillhub 的清爽卡片风 + DSH 品牌「鲸鱼蓝」。
- **主色**：`#1a56db`（深蓝，DSH 品牌）/ 辅助冰蓝 `#4dabf7`；深色模式跟随系统。
- **字体**：系统无衬线栈（`Inter`/`PingFang SC`/`Microsoft YaHei`）。
- **卡片**：白底圆角 12px、细描边、hover 微抬升 + 阴影。
- **徽标**：分类用柔和色块；「原生 bundle」用品牌蓝实心。
- **响应式**：桌面 3–4 列网格 → 平板 2 列 → 手机单列；筛选栏在移动端变抽屉。

## 9. 设计决策（默认值，可调整）

| # | 决策点 | 默认建议 |
|---|---|---|
| D1 | 917 个仓库是否全收录 | 全收录，但打 `type` 标签；默认只显示「原生插件/bundle + 仓库插件」，可切换「全部」 |
| D2 | 技术栈 | 静态站 + 构建期爬取 + CI 定时刷新 |
| D3 | UI 语言 | 中文为主 |
| D4 | 「评分」口径 | 用 Stars 作为热度排序（替代 skillhub 的人工评分） |
| D5 | 图片策略 | 下载本地托管；每仓库 ≤6 张；跳过视频与徽章 |
| D6 | 数据刷新 | GitHub Action 定时重爬（默认每日） |
