type Props = {
  compact?: boolean
}

export function BrandMark({ compact = false }: Props) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup-compact' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="2" y="2" width="36" height="36" rx="11" fill="currentColor" opacity="0.14" />
        <path d="M12 13h8v8h-8zM20 21h8v8h-8z" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M20 17h4a4 4 0 0 1 4 4M20 25h-4a4 4 0 0 1-4-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {!compact && <span className="brand-wordmark">Supply<span>Chain</span></span>}
    </div>
  )
}
