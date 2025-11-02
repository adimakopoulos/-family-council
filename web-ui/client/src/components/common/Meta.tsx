import React from 'react'

export default function Meta({ label, value }: { label: string; value?: string | number }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xs text-slate-700 font-medium truncate">{value}</span>
    </div>
  )
}
