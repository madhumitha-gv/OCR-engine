import { useEffect, useState } from 'react'
import StatusIndicator from './StatusIndicator'
import ProfileDropdown from './ProfileDropdown'

interface Props {
  onOpenHistory: () => void
}

export default function Header({ onOpenHistory }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 h-14
        border-b border-border-dim transition-all duration-300
        ${scrolled ? 'bg-bg-base/80 backdrop-blur-md' : 'bg-bg-base'}`}
    >
      {/* Left — logo + name */}
      <div className="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
          <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="#7c80b0" strokeWidth="1.5" fill="rgba(124,128,176,0.08)" />
          <rect x="9" y="9" width="12" height="12" rx="2.5" stroke="#9094c4" strokeWidth="1.5" fill="rgba(144,148,196,0.08)" />
          <circle cx="7" cy="7" r="1.5" fill="#7c80b0" />
          <circle cx="21" cy="21" r="1.5" fill="#9094c4" />
          <circle cx="14" cy="14" r="2" fill="#a4a8d8" />
          <line x1="7" y1="7" x2="14" y2="14" stroke="#7c80b0" strokeWidth="0.75" strokeOpacity="0.5" />
          <line x1="14" y1="14" x2="21" y2="21" stroke="#9094c4" strokeWidth="0.75" strokeOpacity="0.5" />
        </svg>
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-text-primary">
          CodeNova
        </span>
      </div>

      {/* Right — status + divider + event + profile */}
      <div className="flex items-center gap-4">
        <StatusIndicator />
        <div className="w-px h-4 bg-border-dim" />
        <span className="text-[12px] text-text-muted font-medium hidden sm:block">IU Hackathon 2026</span>
        <div className="w-px h-4 bg-border-dim hidden sm:block" />
        <ProfileDropdown onOpenHistory={onOpenHistory} />
      </div>
    </header>
  )
}
