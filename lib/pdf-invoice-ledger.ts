/**
 * Invoice ledger PDF — a printable statement of invoices with a running balance.
 *
 * Shared by the invoices list (every invoice matching the current filters) and the
 * project detail page (one project's invoices), so a ledger printed from either
 * place foots the same way.
 *
 * Rows run oldest to newest regardless of how the screen is sorted. A running
 * balance only means anything read chronologically, and that column is what makes
 * this a ledger rather than a list.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface LedgerRow {
  invoiceNumber: string
  invoiceDate?: string | null
  dueDate?: string | null
  reference?: string
  amount: number
  paid: number
  status?: string
}

export interface LedgerOptions {
  title?: string
  subtitle?: string
  /** Column heading for the reference field — 'Client' on the list, usually 'Client' per project too. */
  referenceHeading?: string
  companyName?: string
  filename?: string
}

const NAVY: [number, number, number] = [26, 58, 107]
const LINEN: [number, number, number] = [240, 238, 233]

const money = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v || 0)

const shortDate = (d?: string | null) => {
  if (!d) return '—'
  const dt = new Date(String(d) + (String(d).includes('T') ? '' : 'T00:00:00'))
  return isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Sorts on the numeric part, like the invoices list: the numbers are zero-padded to
// three digits, so a string sort would hold only until INV-1000.
const seq = (n: string) => {
  const m = String(n || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
}

export function buildInvoiceLedgerPDF(rows: LedgerRow[], opts: LedgerOptions = {}) {
  const ordered = [...rows].sort((a, b) => {
    const d = String(a.invoiceDate || '').localeCompare(String(b.invoiceDate || ''))
    return d !== 0 ? d : seq(a.invoiceNumber) - seq(b.invoiceNumber)
  })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...NAVY)
  doc.text(opts.companyName || 'Archon Construction LLC', pageWidth / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(12)
  doc.text(opts.title || 'Invoice Ledger', pageWidth / 2, y, { align: 'center' })

  if (opts.subtitle) {
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60)
    doc.text(opts.subtitle, pageWidth / 2, y, { align: 'center', maxWidth: pageWidth - margin * 2 })
  }

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    pageWidth / 2, y, { align: 'center' },
  )
  y += 9

  let running = 0
  const body = ordered.map((r) => {
    const balance = (r.amount || 0) - (r.paid || 0)
    running += balance
    return [
      r.invoiceNumber || '—',
      shortDate(r.invoiceDate),
      shortDate(r.dueDate),
      r.reference || '—',
      money(r.amount),
      money(r.paid),
      money(balance),
      money(running),
    ]
  })

  const totals = ordered.reduce(
    (a, r) => ({ amount: a.amount + (r.amount || 0), paid: a.paid + (r.paid || 0) }),
    { amount: 0, paid: 0 },
  )

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Invoice', 'Date', 'Due', opts.referenceHeading || 'Client', 'Amount', 'Paid', 'Balance', 'Running']],
    body,
    foot: [[
      'TOTAL', '', '', `${ordered.length} invoice${ordered.length === 1 ? '' : 's'}`,
      money(totals.amount), money(totals.paid), money(totals.amount - totals.paid), '',
    ]],
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [33, 47, 61] },
    footStyles: { fillColor: LINEN, textColor: NAVY, fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' }, 5: { halign: 'right' },
      6: { halign: 'right' }, 7: { halign: 'right' },
    },
    theme: 'striped',
  })

  let endY = (doc as any).lastAutoTable.finalY + 8
  if (endY > 250) { doc.addPage(); endY = 20 }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    'Running balance is cumulative unpaid amount in invoice date order. Paid reflects payments recorded against each invoice.',
    margin, endY, { maxWidth: pageWidth - margin * 2 },
  )

  // Page numbers, added last so the count is final.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
  }

  return doc
}

export function downloadInvoiceLedgerPDF(rows: LedgerRow[], opts: LedgerOptions = {}) {
  const doc = buildInvoiceLedgerPDF(rows, opts)
  doc.save(opts.filename || `invoice-ledger-${new Date().toISOString().split('T')[0]}.pdf`)
}
