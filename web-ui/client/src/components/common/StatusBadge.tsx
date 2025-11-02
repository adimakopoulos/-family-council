import React from 'react'
import { useTranslation } from 'react-i18next'
import type { Proposal } from '../types'

export default function StatusBadge({ status }: { status: Proposal['status'] }) {
  const { t } = useTranslation()
  const styles: Record<string, string> = {
    open: 'bg-amber-50 text-amber-700 border-amber-200',
    passed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  const icon: Record<string, string> = { open: '🟡', passed: '✅', rejected: '❌' }

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${styles[status] || ''}`}>
      <span>{icon[status] || '•'}</span>
      <span className="font-medium">{t(`status.${status}`)}</span>
    </span>
  )
}
