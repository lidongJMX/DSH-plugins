import { useEffect, useState } from 'react'

export function useTheme(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dsh-hub-theme')
      if (saved === 'dark') return true
      if (saved === 'light') return false
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('dsh-hub-theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])

  return [dark, setDark]
}
