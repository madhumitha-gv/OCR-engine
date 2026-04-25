import { useState } from 'react'
import type { NoiseProfile } from '../api'

interface Props {
  value: NoiseProfile
  onChange: (v: NoiseProfile) => void
}

const OPTIONS: { value: NoiseProfile; label: string; sub: string }[] = [
  { value: 'none',            label: 'None',           sub: 'Clean image' },
  { value: 'gaussian',        label: 'Gaussian',       sub: 'Blur / sensor' },
  { value: 'salt_and_pepper', label: 'Salt & Pepper',  sub: 'Pixel corruption' },
  { value: 'crumpled',        label: 'Crumpled',       sub: 'Folds / shadows' },
  { value: 'stained',         label: 'Stained',        sub: 'Discoloration' },
  { value: 'both',            label: 'All',            sub: 'All noise types' },
]

const DESCRIPTIONS: Record<NoiseProfile, string> = {
  none:            'Image has no noise. The CNN passes the image directly to OCR for clean inference.',
  gaussian:        'Image contains Gaussian noise. The CNN applies noise-aware denoising to recover blurred or sensor-degraded text.',
  salt_and_pepper: 'Image contains salt-and-pepper noise. The CNN uses median-filter preprocessing to remove randomly corrupted pixels before OCR.',
  both:            'Image contains both Gaussian and salt-and-pepper noise. The CNN applies full multi-stage denoising for heavily degraded inputs.',
  crumpled:        'Image is crumpled or folded. The CNN uses CLAHE to normalize uneven lighting from fold shadows and sharpens edges lost in creases.',
  stained:         'Image has stains or discoloration. The CNN applies aggressive contrast normalization to cut through blotches and restore text clarity.',
}

export default function NoiseSelector({ value, onChange }: Props) {
  const [descKey,    setDescKey]    = useState<NoiseProfile>(value)
  const [descVisible, setDescVisible] = useState(true)

  function handleChange(v: NoiseProfile) {
    onChange(v)
    setDescVisible(false)
    setTimeout(() => {
      setDescKey(v)
      setDescVisible(true)
    }, 150)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left
              transition-all duration-200 cursor-pointer
              ${value === opt.value
                ? 'bg-accent/15 border-accent/40 text-text-primary'
                : 'bg-bg-surface border-border-dim text-text-muted hover:border-border-bright hover:text-text-secondary'
              }`}
          >
            <span className="text-[12px] font-medium leading-none mb-1">
              {opt.label}
            </span>
            <span className="text-[10px] text-text-muted leading-none">
              {opt.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Description */}
      <div
        className="p-3 bg-bg-elevated border border-border-dim rounded-lg text-[12px] text-text-secondary leading-relaxed transition-all duration-150"
        style={{
          opacity:   descVisible ? 1 : 0,
          transform: descVisible ? 'translateY(0)' : 'translateY(4px)',
        }}
      >
        {DESCRIPTIONS[descKey]}
      </div>
    </div>
  )
}
