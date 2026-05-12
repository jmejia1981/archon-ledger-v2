'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Link
        href="/dashboard"
        className="text-sm hover:opacity-80 transition"
        style={{ color: 'var(--color-navy)' }}
      >
        Dashboard
      </Link>

      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
          {item.href ? (
            <Link
              href={item.href}
              className="text-sm hover:opacity-80 transition"
              style={{ color: 'var(--color-navy)' }}
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
