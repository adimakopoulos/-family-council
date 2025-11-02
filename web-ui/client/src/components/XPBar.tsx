import React from 'react'
import clsx from 'clsx'

export default function XPBar({
  pct,
  label,
  flash,
  height = 8,     // NEW: default thickness (px). You set 12 in callers.
}: {
  pct: number
  label?: string
  flash?: boolean
  height?: number
}) {
  const safePct = Math.max(0, Math.min(100, pct || 0))

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1 text-[11px] text-slate-600">{label}</div>
      ) : null}
      <div
        className={clsx(
          'w-full rounded-full bg-slate-200 overflow-hidden',
          flash && 'ring-2 ring-amber-300'
        )}
        style={{ height }}
        aria-label="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safePct)}
      >
        <div
          className="h-full bg-brand-600 transition-[width] duration-500"
          style={{ width: `${safePct}%` }}
        />
      </div>
    </div>
  )
}
