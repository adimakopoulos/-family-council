// src/components/XPBar.tsx
import React from 'react'
import clsx from 'clsx'

export default function XPBar({
  pct,
  height = '6px',
  flash = false,
  label,
}: {
  pct: number
  height?: string
  flash?: boolean
  label?: string
}) {
  const cl = clsx('relative w-full rounded-full bg-slate-200/70 overflow-hidden')
  return (
    <div className={cl} style={{ height }}>
      <div
        className={clsx(
          'h-full rounded-full transition-all duration-700',
          flash && 'shadow-[0_0_0_2px_rgba(34,197,94,0.35)]'
        )}
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: 'linear-gradient(90deg, #34d399, #22c55e)', // emerald gradient
        }}
      />
      {label ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700">
          {label}
        </div>
      ) : null}
    </div>
  )
}
