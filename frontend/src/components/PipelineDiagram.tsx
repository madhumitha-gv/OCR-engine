export default function PipelineDiagram() {
  const stages = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 7h10M4 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="13" cy="10" r="1" fill="currentColor" />
        </svg>
      ),
      label: 'Input Image',
      sublabel: 'Upload + noise selection',
      color: '#7c80b0',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="6" cy="7" r="1.5" fill="currentColor" opacity="0.6" />
          <circle cx="12" cy="7" r="1.5" fill="currentColor" opacity="0.6" />
          <path d="M6 12c0-1.66 1.34-3 3-3s3 1.34 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
      label: 'Stage 1: OCR',
      sublabel: 'DenoisingCNN + OCR',
      color: '#9094c4',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 9c1.5-4 2.5-4 3.5 0s2 4 3.5 0 2.5-4 3.5 0 1.5 4 3.5 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
      label: 'Stage 2: Huffman',
      sublabel: 'Adaptive FGK encoding',
      color: '#a4a8d8',
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2 8V2h5M16 8V2h-5M2 10v6h5M16 10v6h-5M7 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
      label: 'Output',
      sublabel: 'Text + compression metrics',
      color: '#6366f1',
    },
  ]

  return (
    <div className="p-4 bg-bg-surface border border-border-dim rounded-xl">
      <p className="label mb-4">Pipeline Architecture</p>
      <div className="flex flex-col gap-0">
        {stages.map((stage, i) => (
          <div key={i}>
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${stage.color}22`, color: stage.color, border: `1px solid ${stage.color}44` }}
              >
                {stage.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary leading-tight">{stage.label}</p>
                <p className="text-[11px] text-text-muted mt-0.5">{stage.sublabel}</p>
              </div>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1.5 text-[10px] font-bold"
                style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
              >
                {i + 1}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="ml-[15px] w-px h-4 bg-border-dim my-0.5" />
            )}
          </div>
        ))}
      </div>

      {/* Tech stack pills */}
      <div className="mt-4 pt-3 border-t border-border-dim flex flex-wrap gap-1.5">
        {['OCR', 'U-Net CNN', 'FGK Huffman', 'FastAPI', 'SQLite'].map((tech) => (
          <span
            key={tech}
            className="px-2 py-0.5 rounded text-[10px] font-medium text-text-muted border border-border-dim bg-bg-elevated"
          >
            {tech}
          </span>
        ))}
      </div>
    </div>
  )
}
