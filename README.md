# DSH 插件中心 · DSH Plugin Hub

> 类似 [skillhub.cn/skills](https://www.skillhub.cn/skills?sortBy=score) 的中文插件目录站：
> 把 [GitHub topic:dsh-plugin](https://github.com/topics/dsh-plugin) 下的全部 DSH（DeepSeek Harness）
> 插件聚合起来，供用户搜索、筛选、排序，并一键复制安装命令、查看插件截图。

- 全量收录：GitHub `dsh-plugin` topic 全部仓库（当前约 900+），默认只展示插件类，可一键切换查看全部
- 搜索 / 分类 / 类型 / 语言筛选 / 排序 / 分页
- 每个插件：精简介绍 + 安装命令（一键复制）+ 多步安装说明 + 本地化截图画廊
- 深色模式、响应式布局
- 纯静态站：构建期爬虫生成数据，GitHub Actions 每日定时刷新并部署到 GitHub Pages

## 技术栈

- 前端：Vite + React + TypeScript + Tailwind CSS + React Router（HashRouter，适配子路径部署）
- 数据：Node 爬虫（`scripts/crawl.mjs`，零依赖，Node ≥ 18）
- 部署：GitHub Actions → GitHub Pages

## 本地开发

```bash
npm install

# 1. 爬取数据（生成 public/data/plugins.json 与 public/plugins/ 下的图片）
npm run crawl          # 增量（跳过已有缓存）
npm run crawl:force    # 强制全量重爬
node scripts/crawl.mjs --repos-only   # 只刷新仓库列表（快速）

# 2. 启动开发服务器
npm run dev            # http://localhost:5173

# 3. 构建产物
npm run build
npm run preview        # 本地预览构建产物
```

> 可选：设置环境变量 `GITHUB_TOKEN` 可提升 Search API 限流；未设置也能运行（爬虫自带限速）。

## 数据是怎么来的

```
GitHub Search API (topic:dsh-plugin, 分页 + 1000 上限按创建时间窗口拆分)
        │
        ▼
raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>   ← HEAD 伪引用 = 默认分支，免 API 限流
        │
        ▼
解析 README ──► 简介 / 安装命令(多级识别+兜底) / 图片URL
解析 package.json ──► 是否为原生 bundle（dsh.bundle）
下载图片 ──► public/plugins/<owner>/<repo>/img-*.{png,jpg,webp,gif}
        │
        ▼
public/data/plugins.json（前端消费）
```

## 数据刷新机制（GitHub Actions）

| 触发时机 | 行为 |
|---|---|
| 首次 push（无缓存） | **全量拉取**：topic 列表 + 全部仓库 README/package.json + 图片下载 |
| 之后每次 push | **增量**：`actions/cache` 恢复上次缓存（readmes / package-jsons / image-stamps / 图片），已处理的仓库直接跳过 |
| 每天 03:17 UTC（cron） | 自动增量刷新，数据保鲜 |
| Actions 页面手动 Run workflow | 同上 |

- 每次运行都会用 `FORCE_REPOS=1` **强制重拉 topic 仓库列表**（抓新插件、更新 Star 数），README/package.json/图片则走增量缓存 —— 所以日常刷新是分钟级，不是全量重来。
- 本地 `npm run crawl`（不带 `--force`）同理是增量；想强制全量用 `npm run crawl:force`。

## 部署到你的 GitHub

1. 把本仓库推到 GitHub（`main` 分支）。
2. 仓库 Settings → Pages → **Build and deployment → Source: GitHub Actions**。
3. 之后每次 push 或每天定时，Action 会自动：重爬数据 → 构建 → 冒烟测试（在 Action 内起服务器 curl 检查）→ 部署。
4. 站点地址：`https://<你的用户名>.github.io/<仓库名>/`。

## 目录结构

```
scripts/crawl.mjs          数据爬虫（零依赖）
data/                      爬虫缓存（repos/readmes/package-jsons，gitignore）
public/data/plugins.json   最终数据集（构建期生成，gitignore）
public/plugins/            下载的插件图片（gitignore）
src/                       前端源码
  lib/                     类型 / 常量 / 数据加载与筛选逻辑
  components/              通用组件（卡片/复制/分页/画廊…）
  pages/                   列表页与详情页
.github/workflows/deploy.yml  CI/CD
docs/design.md             设计方案
docs/plan.md               开发计划
```

## 免责声明

所有插件信息（简介、安装命令、截图）由爬虫自动采集自对应 GitHub 仓库，仅供参考；
安装命令以各项目 README 为准。数据版权归各插件作者所有。
