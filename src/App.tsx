import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import ListPage from './pages/ListPage'
import DetailPage from './pages/DetailPage'

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <Header />
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/plugin/:owner/:name" element={<DetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
          数据来自 GitHub topic:dsh-plugin，由爬虫自动采集 · 安装命令仅供参考，以项目 README 为准
        </footer>
      </div>
    </HashRouter>
  )
}
