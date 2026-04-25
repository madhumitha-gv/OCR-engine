import { useRef, useState, useCallback, useEffect } from 'react'

interface Props {
  file: File | null
  onChange: (f: File | null) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImageUploader({ file, onChange }: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [lightbox,  setLightbox]  = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false)
    }
    if (lightbox) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  function handleFile(f: File) {
    onChange(f)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  return (
    <div>
      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lightbox && preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <img
            src={preview}
            alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-bg-surface border border-border-dim
              flex items-center justify-center text-text-secondary hover:text-text-primary transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <p className="absolute bottom-4 text-[12px] text-text-muted">Click anywhere or press Esc to close</p>
        </div>
      )}

      {file && preview ? (
        /* ── Preview state ─────────────────────────────────────── */
        <div className="relative rounded-xl border border-border-dim bg-bg-surface overflow-hidden group">
          <div
            className="relative cursor-zoom-in"
            onClick={() => setLightbox(true)}
            title="Click to enlarge"
          >
            <img
              src={preview}
              alt="Selected"
              className="w-full max-h-52 object-contain bg-bg-elevated"
            />
            {/* Expand hint */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-base/80 backdrop-blur-sm border border-border-dim">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-secondary">
                  <path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] text-text-secondary">Enlarge</span>
              </div>
            </div>
          </div>
          {/* Clear button */}
          <button
            onClick={clear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-bg-base/80 backdrop-blur-sm
              border border-border-dim flex items-center justify-center text-text-secondary
              hover:text-text-primary hover:border-border-bright transition-all duration-200"
            title="Remove image"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {/* File info */}
          <div className="px-3 py-2 border-t border-border-dim flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-muted flex-shrink-0">
              <rect x="1" y="1" width="8" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9 1h2l2 2v9a1 1 0 01-1 1h-3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span className="text-[12px] font-mono text-text-secondary truncate">{file.name}</span>
            <span className="text-[11px] font-mono text-text-muted ml-auto flex-shrink-0">
              {formatBytes(file.size)}
            </span>
          </div>
        </div>
      ) : (
        /* ── Drop zone ─────────────────────────────────────────── */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`w-full flex flex-col items-center justify-center gap-3 py-10 px-6
            rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center
            ${dragging
              ? 'border-accent bg-accent/10'
              : 'border-border-dim hover:border-accent hover:bg-accent/5'
            }`}
        >
          {/* Cloud upload icon */}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={`transition-colors duration-200 ${dragging ? 'text-accent' : 'text-accent/60'}`}>
            <path d="M16 32a10 10 0 110-20 10 10 0 0110-8h0a14 14 0 0114 14v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 36a8 8 0 000-16H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M24 28v12M20 32l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div>
            <p className="text-[14px] font-medium text-text-primary mb-1">
              Drop image here
            </p>
            <p className="text-[13px] text-text-muted">
              or <span className="text-accent underline underline-offset-2">click to browse</span>
            </p>
          </div>
          <p className="text-[11px] text-text-muted">Supports JPG, PNG, BMP</p>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
    </div>
  )
}
