import { useEffect, useState, useCallback } from 'react'
import type { PipelineResult } from '../api'

interface Props {
  result: PipelineResult
}

export default function CompressionVisualizer({ result }: Props) {
  const [animated,   setAnimated]   = useState(false)
  const [showBits,   setShowBits]   = useState(false)
  const [treeModal,  setTreeModal]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const closeModal = useCallback(() => setTreeModal(false), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    if (treeModal) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [treeModal, closeModal])

  const { original_size_bits: orig, compressed_size_bits: comp } = result
  const compRatio = comp / orig            // fraction of original
  const savedPct  = Math.round((1 - compRatio) * 100)
  const savedBits = orig - comp

  const renderTree = (node: any, path = ""): JSX.Element => {
    if (!node) return <></>
    if (node.type === "leaf") {
      return (
        <div className="inline-block p-1.5 m-1 bg-accent/20 border border-accent/30 rounded text-text-primary" style={{ fontSize: '10px' }}>
          <div className="font-mono text-accent truncate">'{node.char}'</div>
          <div className="text-text-secondary">W:{node.weight}</div>
          <div className="text-text-secondary truncate">{node.code}</div>
        </div>
      )
    } else {
      return (
        <div className="inline-block text-center">
          <div className="p-1 m-1 bg-bg-elevated border border-border-dim rounded text-text-secondary" style={{ fontSize: '10px' }}>W:{node.weight}</div>
          <div className="flex">
            {node.left && (
              <div className="flex flex-col items-center mr-1">
                <div className="text-text-muted" style={{ fontSize: '9px' }}>0</div>
                <div className="border-l-2 border-t-2 border-border-dim w-3 h-3"></div>
                {renderTree(node.left, path + "0")}
              </div>
            )}
            {node.right && (
              <div className="flex flex-col items-center ml-1">
                <div className="text-text-muted" style={{ fontSize: '9px' }}>1</div>
                <div className="border-r-2 border-t-2 border-border-dim w-3 h-3"></div>
                {renderTree(node.right, path + "1")}
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  return (
    <div className="p-4 bg-bg-surface border border-border-dim rounded-xl">
      <p className="label mb-4">Compression Visualization</p>

      <div className="flex flex-col gap-2.5">
        {/* Original bar */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-medium text-text-muted">Original</span>
            <span className="text-[11px] font-mono text-text-secondary">{orig} bits</span>
          </div>
          <div className="h-7 bg-bg-elevated rounded-md overflow-hidden">
            <div
              className="h-full rounded-md transition-all duration-700 ease-out"
              style={{
                width: animated ? '100%' : '0%',
                background: 'linear-gradient(90deg, #3a3a4a, #4a4a5a)',
              }}
            />
          </div>
        </div>

        {/* Compressed bar */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-medium text-text-muted">Compressed</span>
            <span className="text-[11px] font-mono text-accent">{comp} bits</span>
          </div>
          <div className="h-7 bg-bg-elevated rounded-md overflow-hidden">
            <div
              className="h-full rounded-md transition-all duration-[800ms] ease-out"
              style={{
                width: animated ? `${compRatio * 100}%` : '0%',
                background: 'linear-gradient(90deg, #5a5e8a, #7c80b0)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-success flex-shrink-0">
          <path d="M2 9l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[12px] font-medium text-success">
          Saved {savedBits} bits&nbsp;
          <span className="text-success/70">({savedPct}% reduction)</span>
        </span>
      </div>

      {/* Huffman Details */}
      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTreeModal(true)}
            className="px-3 py-1 text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded transition-colors"
          >
            View Huffman Tree
          </button>
          <button
            type="button"
            onClick={() => setShowBits(!showBits)}
            className="px-3 py-1 text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 rounded transition-colors"
          >
            {showBits ? 'Hide' : 'Show'} Encoded Bits
          </button>
        </div>

        {/* Huffman Tree Modal */}
        {treeModal && !!result.huffman_tree && (
          <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: 'rgb(5,5,8)' }}
            onClick={closeModal}
          >
            <div
              className="flex-1 overflow-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[14px] font-semibold text-text-primary">Huffman Tree</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-8 h-8 rounded-lg bg-bg-surface border border-border-dim flex items-center justify-center text-text-muted hover:text-text-primary transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="inline-block min-w-full">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {renderTree(result.huffman_tree as any)}
              </div>
            </div>
            <p className="text-center text-[11px] text-text-muted pb-3">Click outside or press Esc to close</p>
          </div>
        )}

        {showBits && result.encoded_bits && (
          <div className="p-3 bg-bg-elevated rounded border">
            <p className="text-xs font-medium mb-2">Encoded Bit String</p>
            <div className="font-mono text-xs bg-bg-base text-accent p-2 rounded max-h-32 overflow-y-auto border border-border-dim">
              {result.encoded_bits.match(/.{1,64}/g)?.join('\n') || result.encoded_bits}
            </div>
          </div>
        )}

        {result.symbol_frequencies && (
          <div className="p-3 bg-bg-elevated rounded border">
            <p className="text-xs font-medium mb-2">Symbol Frequencies</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {Object.entries(result.symbol_frequencies).map(([byte, freq]) => (
                <div key={byte} className="flex justify-between">
                  <span>'{String.fromCharCode(parseInt(byte))}' ({byte})</span>
                  <span>{freq}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
