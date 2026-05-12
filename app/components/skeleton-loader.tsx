'use client'

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6 animate-pulse"></div>
      </div>
    </div>
  )
}

export function SkeletonTableRow() {
  return (
    <tr style={{ borderBottom: `1px solid var(--color-border)` }}>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
      </td>
      <td className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
      </td>
    </tr>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonKPICards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-lg p-6 shadow-sm" style={{ border: `1px solid var(--color-border)` }}>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: `1px solid var(--color-border)` }}>
      <table className="w-full">
        <thead style={{ backgroundColor: 'var(--color-linen)', borderBottom: `1px solid var(--color-border)` }}>
          <tr>
            <th className="px-6 py-3">
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            </th>
            <th className="px-6 py-3">
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </th>
            <th className="px-6 py-3">
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            </th>
            <th className="px-6 py-3">
              <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
            </th>
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
