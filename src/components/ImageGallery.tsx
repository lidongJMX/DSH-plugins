import { useCallback, useEffect, useState } from 'react'
import type { Plugin, PluginImage } from '../lib/types'
import { imgUrl } from '../lib/store'

export default function ImageGallery({
  plugin,
  images,
}: {
  plugin: Plugin
  images: PluginImage[]
}) {
  const [open, setOpen] = useState<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const prev = useCallback(
    () => setOpen((i) => (i === null ? null : (i + images.length - 1) % images.length)),
    [images.length],
  )
  const next = useCallback(
    () => setOpen((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  )

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, prev, next])

  if (images.length === 0) return null

  return (
    <section aria-label="截图预览">
      <h2 className="mb-3 text-base font-semibold">截图预览</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((im, i) => (
          <button
            key={im.file}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            title={im.alt || '点击放大'}
          >
            <img
              src={imgUrl(plugin, im.file)}
              alt={im.alt || `${plugin.name} 截图 ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="截图大图"
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={close}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                aria-label="上一张"
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                aria-label="下一张"
              >
                ›
              </button>
            </>
          )}
          <figure className="max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={imgUrl(plugin, images[open].file)}
              alt={images[open].alt || `${plugin.name} 截图 ${open + 1}`}
              className="max-h-[82vh] max-w-full rounded-lg object-contain"
            />
            <figcaption className="mt-2 text-center text-sm text-gray-300">
              {images[open].alt || `${plugin.name} · ${open + 1} / ${images.length}`}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
