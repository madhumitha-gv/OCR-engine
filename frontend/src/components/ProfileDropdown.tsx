import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getProfile, getRunHistory } from '../api'

interface Props {
  onOpenHistory: () => void
}

function initials(name: string | null, username: string): string {
  const src = name || username
  const parts = src.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

export default function ProfileDropdown({ onOpenHistory }: Props) {
  const { user, token, logout } = useAuth()
  const [open,       setOpen]       = useState(false)
  const [totalRuns,  setTotalRuns]  = useState<number | null>(null)
  const [avgConf,    setAvgConf]    = useState<number | null>(null)
  const [avgRatio,   setAvgRatio]   = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !token) return
    getProfile(token)
      .then((p) => setTotalRuns(p.total_runs))
      .catch(() => {/* silent */})
    getRunHistory(token, 0, 20)
      .then((runs) => {
        const withConf  = runs.filter((r) => r.confidence !== null)
        const withRatio = runs.filter((r) => r.compression_ratio !== null)
        if (withConf.length)  setAvgConf(withConf.reduce((s, r) => s + r.confidence!, 0) / withConf.length)
        if (withRatio.length) setAvgRatio(withRatio.reduce((s, r) => s + r.compression_ratio!, 0) / withRatio.length)
      })
      .catch(() => {/* silent */})
  }, [open, token])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  if (!user) return null

  const label = initials(user.display_name, user.username)

  return (
    <div ref={dropdownRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold
          border transition-all duration-200 select-none
          ${open
            ? 'border-accent bg-accent/20 text-accent'
            : 'border-border-dim bg-bg-elevated text-text-secondary hover:border-border-bright hover:text-text-primary'
          }`}
      >
        {label}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 bg-bg-surface border border-border-dim
            rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50"
          style={{ animation: 'fadeUp 0.15s ease-out both' }}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-border-dim">
            <p className="text-[14px] font-semibold text-text-primary truncate">
              {user.display_name || user.username}
            </p>
            <p className="text-[12px] text-text-muted truncate mt-0.5">@{user.username}</p>
          </div>

          {/* Stats grid */}
          <div className="px-3 py-2.5 border-b border-border-dim grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[16px] font-semibold font-mono text-text-primary">
                {totalRuns ?? '—'}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Runs</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold font-mono" style={{ color: avgConf !== null ? (avgConf > 0.8 ? '#22c55e' : avgConf >= 0.6 ? '#f59e0b' : '#ef4444') : undefined }}>
                {avgConf !== null ? `${(avgConf * 100).toFixed(0)}%` : '—'}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Avg Conf</p>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-semibold font-mono" style={{ color: avgRatio !== null ? (avgRatio > 1.5 ? '#22c55e' : avgRatio >= 1.0 ? '#f59e0b' : '#ef4444') : undefined }}>
                {avgRatio !== null ? `${avgRatio.toFixed(2)}×` : '—'}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Avg Ratio</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-1.5 flex flex-col gap-0.5">
            <button
              onClick={() => { onOpenHistory(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-text-secondary
                hover:bg-bg-elevated hover:text-text-primary transition-all duration-150 text-left"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Run History
            </button>

            <div className="h-px bg-border-dim mx-1 my-0.5" />

            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-error/80
                hover:bg-error/10 hover:text-error transition-all duration-150 text-left"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
