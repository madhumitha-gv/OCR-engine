import { useEffect, useRef, useState } from 'react'
import type { PipelineResult } from '../api'

// ── useCountUp hook ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800, decimals = 2) {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(parseFloat((eased * target).toFixed(decimals)))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, decimals])

  return val
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
  fullWidth?: boolean
}

function MetricCard({ label, icon, children, fullWidth }: MetricCardProps) {
  return (
    <div
      className={`relative p-4 bg-bg-surface border border-border-dim rounded-xl
        transition-all duration-200 hover:border-border-bright hover:shadow-card group
        ${fullWidth ? 'col-span-2' : ''}`}
    >
      <div className="absolute top-3 right-3 text-text-muted group-hover:text-text-secondary transition-colors duration-200">
        {icon}
      </div>
      <p className="label mb-2">{label}</p>
      {children}
    </div>
  )
}

// ── Icon components ───────────────────────────────────────────────────────────

const IconCompress = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4M6 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
const IconWave = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 8c1-3 2-3 3 0s2 3 3 0 2-3 3 0 2 3 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)
const IconGauge = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 11a5.5 5.5 0 1110 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M8 11L5 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="11" r="1" fill="currentColor" />
  </svg>
)
const IconDatabase = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 4v4c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 8v4c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

// ── Color helpers (hex to avoid Tailwind JIT issues) ──────────────────────────

const COLOR_GOOD = '#22c55e'
const COLOR_WARN = '#f59e0b'
const COLOR_BAD  = '#ef4444'

function ratioColor(v: number)   { return v > 1.5 ? COLOR_GOOD : v >= 1.0 ? COLOR_WARN : COLOR_BAD }
function effColor(v: number)     { return v > 85  ? COLOR_GOOD : v >= 60  ? COLOR_WARN : COLOR_BAD }
function latencyColor(v: number) { return v < 5000 ? COLOR_GOOD : v <= 15000 ? COLOR_WARN : COLOR_BAD }
function latencyWidth(v: number) { return `${Math.min((v / 20000) * 100, 100)}%` }

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  result: PipelineResult
}

export default function MetricsGrid({ result }: Props) {
  const ratio      = useCountUp(result.compression_ratio, 800, 2)
  const entropy    = useCountUp(result.entropy, 800, 2)
  const efficiency = useCountUp(result.encoding_efficiency * 100, 800, 1)
  const latency    = useCountUp(result.pipeline_latency_ms, 800, 1)

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 1. Compression Ratio */}
      <MetricCard label="Compression Ratio" icon={<IconCompress />}>
        <p className="text-[28px] font-semibold font-mono" style={{ color: ratioColor(ratio) }}>
          {ratio.toFixed(2)}×
        </p>
      </MetricCard>

      {/* 2. Entropy */}
      <MetricCard label="Entropy" icon={<IconWave />}>
        <p className="text-[28px] font-semibold font-mono text-text-primary">
          {entropy.toFixed(2)}
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">bits / char</p>
      </MetricCard>

      {/* 3. Encoding Efficiency */}
      <MetricCard label="Encoding Efficiency" icon={<IconGauge />}>
        <p className="text-[28px] font-semibold font-mono" style={{ color: effColor(efficiency) }}>
          {efficiency.toFixed(1)}%
        </p>
      </MetricCard>

      {/* 4. Size Reduction */}
      <MetricCard label="Size Reduction" icon={<IconDatabase />}>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-[16px] font-medium text-text-secondary">
            {result.original_size_bits}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-muted flex-shrink-0">
            <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[16px] font-medium text-accent">
            {result.compressed_size_bits}
          </span>
        </div>
        <p className="text-[11px] text-text-muted mt-1">bits</p>
      </MetricCard>

      {/* 5. Pipeline Latency — full width */}
      <MetricCard label="Pipeline Latency" icon={<IconClock />} fullWidth>
        <p className="text-[28px] font-semibold font-mono" style={{ color: latencyColor(latency) }}>
          {latency.toFixed(0)}ms
        </p>
        <div className="mt-2 h-1 bg-bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: latencyWidth(result.pipeline_latency_ms), backgroundColor: latencyColor(result.pipeline_latency_ms) }}
          />
        </div>
        <p className="text-[11px] text-text-muted mt-1">scale: 0 – 20s</p>
      </MetricCard>
    </div>
  )
}
