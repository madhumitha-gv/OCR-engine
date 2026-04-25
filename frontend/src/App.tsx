import { useState, useRef } from 'react'
import { runPipeline, decompressOutput, type PipelineResult } from './api'

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0110 10" stroke="#111" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: done ? '#111' : '#f3f4f6',
      color: done ? '#fff' : '#6b7280',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
      border: done ? 'none' : '1.5px solid #e5e7eb',
      transition: 'all 0.3s',
    }}>
      {done ? <CheckIcon /> : n}
    </div>
  )
}

export default function App() {
  const [file,         setFile]         = useState<File | null>(null)
  const [preview,      setPreview]      = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState<PipelineResult | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [decompressed, setDecompressed] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError(null)
    setDecompressed(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }

  async function handleRun() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setDecompressed(null)
    try {
      const res = await runPipeline({ image: file, noiseProfile: 'none', token: '' })
      setResult(res)
      const dec = await decompressOutput(res.compressed_bytes, res.num_symbols)
      setDecompressed(dec.recovered_text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline failed')
    } finally {
      setLoading(false)
    }
  }

  const hasDenoisedImage = result?.denoised_image
  const hasText          = result?.ocr_text
  const hasCompression   = result?.compression_ratio

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <header style={{
        borderBottom: '1px solid #f0f0f0', padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: '#fff', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#111' }}>CodeNova</span>
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>IU Hackathon 2026</span>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            2-Stage Neural OCR Pipeline
          </h1>
          <p style={{ marginTop: 10, fontSize: 15, color: '#6b7280', fontWeight: 400 }}>
            Upload a document image — we'll denoise it, extract the text, and compress it.
          </p>
        </div>

        {/* Step 1: Upload */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <StepBadge n={1} done={!!file} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Upload Document</span>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed', borderColor: file ? '#111' : '#e5e7eb',
              borderRadius: 12, padding: file ? 0 : '40px 24px', cursor: 'pointer',
              transition: 'all 0.2s', overflow: 'hidden', background: file ? '#000' : '#fafafa',
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: file ? 240 : 160,
            }}
          >
            {preview ? (
              <img src={preview} alt="uploaded" style={{ maxHeight: 320, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ marginBottom: 10, opacity: 0.5 }}><UploadIcon /></div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Drop image here or click to browse</p>
                <p style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>PNG, JPG, JPEG supported</p>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {file && (
            <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              {file.name} · {(file.size / 1024).toFixed(0)} KB
              <button onClick={e => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null); setDecompressed(null) }}
                style={{ marginLeft: 8, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                Remove
              </button>
            </p>
          )}
        </section>

        {/* Run button */}
        <div style={{ marginBottom: 40 }}>
          <button onClick={handleRun} disabled={!file || loading} style={{
            width: '100%', height: 48, borderRadius: 10,
            background: file && !loading ? '#111' : '#f3f4f6',
            color: file && !loading ? '#fff' : '#9ca3af',
            border: 'none', cursor: file && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
          }}>
            {loading ? (
              <><SpinnerIcon /><span>Processing…</span></>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l10 5-10 5V2z" fill="currentColor"/></svg>Run Pipeline</>
            )}
          </button>
          {error && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Step 2: Denoised Image */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <StepBadge n={2} done />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Denoised Image</span>
              </div>
              {hasDenoisedImage ? (
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                  <img src={`data:image/png;base64,${result.denoised_image}`} alt="denoised"
                    style={{ maxHeight: 320, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
              ) : (
                <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', background: '#fafafa', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                  No denoised image returned
                </div>
              )}
            </section>

            {/* Step 3: Extracted Text */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <StepBadge n={3} done />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Extracted Text</span>
                {result.confidence != null && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '3px 10px', borderRadius: 20 }}>
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </span>
                )}
              </div>
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', background: '#fafafa',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.8, color: '#111',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflowY: 'auto',
              }}>
                {hasText || '—'}
              </div>
            </section>

            {/* Step 4: Huffman Compression */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <StepBadge n={4} done />
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Huffman Compression</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0', fontWeight: 600 }}>
                  ✓ Lossless
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Compression Ratio', value: hasCompression ? `${result.compression_ratio?.toFixed(2)}x` : '—', accent: true },
                  { label: 'Entropy', value: result.entropy ? `${result.entropy.toFixed(2)} bits/char` : '—', accent: false },
                  { label: 'Encoding Efficiency', value: result.encoding_efficiency ? `${(result.encoding_efficiency * 100).toFixed(1)}%` : '—', accent: false },
                ].map(m => (
                  <div key={m.label} style={{ padding: '16px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: m.accent ? '#111' : '#fff' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', margin: '0 0 6px' }}>{m.label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: m.accent ? '#fff' : '#111', letterSpacing: '-0.03em' }}>{m.value}</p>
                  </div>
                ))}
              </div>
              {result.original_size_bits && result.compressed_size_bits && (
                <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Original: <strong style={{ color: '#111' }}>{result.original_size_bits.toLocaleString()} bits</strong></span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Compressed: <strong style={{ color: '#111' }}>{result.compressed_size_bits.toLocaleString()} bits</strong></span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, background: '#111', width: `${(result.compressed_size_bits / result.original_size_bits) * 100}%`, transition: 'width 0.8s ease' }} />
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                    Saved {(result.original_size_bits - result.compressed_size_bits).toLocaleString()} bits ({(((result.original_size_bits - result.compressed_size_bits) / result.original_size_bits) * 100).toFixed(0)}% reduction)
                  </p>
                </div>
              )}
              {result.pipeline_latency_ms && (
                <p style={{ marginTop: 4, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>Pipeline latency: {result.pipeline_latency_ms}ms</p>
              )}
            </section>

            {/* Step 5: Decompressed Text */}
            {decompressed && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <StepBadge n={5} done />
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Decompressed Text</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0', fontWeight: 600 }}>
                    100% Lossless Recovery
                  </span>
                </div>
                <div style={{
                  border: '1px solid #bbf7d0', borderRadius: 12, padding: '20px 24px', background: '#f0fdf4',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.8, color: '#111',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflowY: 'auto',
                }}>
                  {decompressed}
                </div>
                <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: decompressed === result.ocr_text ? '#16a34a' : '#dc2626' }}>
                  {decompressed === result.ocr_text
                    ? 'Decompressed text matches extracted text exactly'
                    : 'Minor mismatch — check encoding'}
                </p>
              </section>
            )}

          </div>
        )}
      </main>
    </div>
  )
}