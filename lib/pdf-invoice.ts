/**
 * Professional PDF Invoice Generator - Archon Construction Template
 * Generates invoices matching the modern Archon Construction template design
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
  clientCity?: string
  clientState?: string
  clientZip?: string
  projectName?: string
  projectAddress?: string
  projectCity?: string
  projectState?: string
  companyName?: string
  companyEmail?: string
  companyPhone?: string
  logoImage?: string // Base64 encoded image or data URL
  lineItems: LineItemData[]
  subtotal: number
  tax?: number
  retainage?: number
  amountPaid?: number
  remainingBalance: number
  notes?: string
  paymentTerms?: string
}

interface LineItemData {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

const COLORS = {
  // Brand colors - Archon Construction
  primary: [26, 58, 107], // #1A3A6B - Primary brand blue
  secondary: [143, 163, 184], // #8FA3B8 - Secondary blue-gray
  lightBg: [245, 248, 252], // #F5F8FC - Very light background
  darkText: [33, 47, 61], // #212F3D - Dark text
  borderGray: [200, 210, 220], // #C8D2DC - Soft border
  accent: [200, 184, 154], // #C8B89A - Accent tan color
  white: [255, 255, 255], // White
}

export function generateInvoicePDF(data: InvoiceData, filename: string = 'invoice.pdf') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12 // 0.5" margin for wider content
  const contentWidth = pageWidth - 2 * margin
  let yPosition = margin

  // Add header image if available
  if (data.logoImage) {
    try {
      // Image dimensions: 192mm wide (page width - margins), 15mm tall
      doc.addImage(data.logoImage, 'PNG', 0, 0, pageWidth, 15)
      yPosition = 27 // Start content after header image
    } catch (error) {
      console.error('Error adding header image:', error)
    }
  }

  // Set default font
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.darkText)

  // Handle invoice number with or without INV- prefix
  const invoiceNumberDisplay = data.invoiceNumber.startsWith('INV-')
    ? data.invoiceNumber
    : `INV-${data.invoiceNumber}`

  // Bill From / Bill To Section
  const billFromY = yPosition
  const billFromX = margin
  const billToX = pageWidth - margin // All the way to the right

  yPosition = billFromY

  // Bill From (Left side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)
  doc.text('Bill From', billFromX, yPosition)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  yPosition += 6
  doc.text(data.companyName || 'Archon Construction', billFromX, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)
  yPosition += 5
  doc.text(data.companyEmail || 'archonconstruction.co', billFromX, yPosition)

  yPosition += 4
  doc.text(data.companyPhone || '(551) 212-8820', billFromX, yPosition)

  // Bill To (Far right - ALL THE WAY TO THE RIGHT MARGIN)
  yPosition = billFromY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)
  doc.text('Bill To', billToX, yPosition, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  yPosition += 6
  doc.text(data.clientName, billToX, yPosition, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)
  yPosition += 5
  doc.text(data.clientEmail || data.companyEmail || '', billToX, yPosition, { align: 'right' })

  yPosition += 4
  doc.text(data.clientPhone || data.companyPhone || '', billToX, yPosition, { align: 'right' })

  // Move down for next section
  yPosition = Math.max(yPosition, billFromY + 22) + 8

  // Horizontal line
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(1)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  // Invoice Details (Date, Due Date, Payment Terms, Project Name) - AS PLAIN TEXT
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)

  // Column positions
  const col1X = margin
  const col2X = margin + contentWidth * 0.2
  const col3X = margin + contentWidth * 0.45
  const col4X = pageWidth - margin // Project Name all the way to the right

  // Row 1: Labels
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', col1X, yPosition)
  doc.setFont('helvetica', 'normal')
  doc.text('Invoice Date', col2X, yPosition)
  doc.text('Due Date', col3X, yPosition)
  doc.setFont('helvetica', 'bold')
  doc.text('Project', col4X, yPosition, { align: 'right' })

  yPosition += 5

  // Row 2: Values
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(invoiceNumberDisplay, col1X, yPosition)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.darkText)
  doc.text(formatDate(data.invoiceDate), col2X, yPosition)
  doc.text(formatDate(data.dueDate), col3X, yPosition)
  doc.text(data.projectName || 'Project', col4X, yPosition, { align: 'right' })

  // Row 3: Project Address (directly under project name)
  if (data.projectAddress && data.projectAddress !== data.projectName) {
    yPosition += 4
    doc.text(data.projectAddress, col4X, yPosition, { align: 'right' })
  }

  // Row 4: Payment Terms (all the way to left)
  yPosition += 8
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Terms', col1X, yPosition)
  yPosition += 5

  // Row 5: Payment Terms value
  doc.setFont('helvetica', 'normal')
  doc.text(data.paymentTerms || 'Net 30', col1X, yPosition)

  yPosition += 8

  // Invoice Items Header and Body
  const tableColumns = [
    { header: 'Description', dataKey: 'description' },
    { header: 'Amount', dataKey: 'amount' },
  ]

  const tableBody: any[] = []

  if (data.lineItems && data.lineItems.length > 0) {
    data.lineItems.forEach((item) => {
      tableBody.push({
        description: item.description,
        amount: formatCurrency(item.amount),
      })
    })
  } else {
    tableBody.push({
      description: data.projectAddress || 'Invoice Amount',
      amount: formatCurrency(data.subtotal),
    })
  }

  autoTable(doc, {
    columns: tableColumns,
    body: tableBody,
    startY: yPosition,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.darkText,
      fontStyle: 'bold',
      fontSize: 10,
      padding: 4,
      halign: 'left',
      valign: 'middle',
      lineColor: COLORS.accent,
      lineWidth: 0.2,
      font: 'helvetica',
    },
    bodyStyles: {
      fontSize: 10,
      padding: 3,
      textColor: COLORS.darkText,
      lineColor: COLORS.borderGray,
      lineWidth: 0.2,
      fillColor: [255, 255, 255],
      font: 'helvetica',
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg,
    },
    columnStyles: {
      0: {
        halign: 'left',
        cellWidth: contentWidth * 0.75,
      },
      1: {
        halign: 'right',
        cellWidth: contentWidth * 0.25,
      },
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
    },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 10

  // Totals Section (Right-aligned with proper alignment)
  const amountColumnWidth = 60 // Width for amount column
  const labelX = pageWidth - margin - amountColumnWidth - 5 // Label position
  const amountX = pageWidth - margin - 2 // Amount position (right edge)

  // Subtotal
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)
  doc.text('Subtotal', labelX, yPosition)
  doc.text(formatCurrency(data.subtotal), amountX, yPosition, { align: 'right' })
  yPosition += 6

  // Tax
  if (data.tax && data.tax > 0) {
    doc.text('Tax', labelX, yPosition)
    doc.text(formatCurrency(data.tax), amountX, yPosition, { align: 'right' })
    yPosition += 6
  }

  // Retainage
  if (data.retainage && data.retainage > 0) {
    doc.text('Retainage', labelX, yPosition)
    doc.text(`-${formatCurrency(data.retainage)}`, amountX, yPosition, { align: 'right' })
    yPosition += 6
  }

  // Amount Paid (if any)
  if (data.amountPaid && data.amountPaid > 0) {
    doc.setTextColor([200, 100, 100]) // Reddish for paid
    doc.text('Amount Paid', labelX, yPosition)
    doc.text(`-${formatCurrency(data.amountPaid)}`, amountX, yPosition, { align: 'right' })
    yPosition += 6
    doc.setTextColor(...COLORS.darkText)
  }

  // Separator line before balance
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.2)
  doc.line(labelX - 5, yPosition + 1, pageWidth - margin, yPosition + 1)
  yPosition += 5

  // Amount Due (prominently highlighted - SAME FONT AS DESCRIPTION)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10) // Match Description font size
  doc.setTextColor(...COLORS.darkText)
  doc.setFillColor(...COLORS.accent)
  const balanceBoxHeight = 7
  doc.rect(labelX - 5, yPosition - 3, amountColumnWidth + 10, balanceBoxHeight, 'F')
  doc.text('AMOUNT DUE', labelX, yPosition + 0.5)
  doc.text(formatCurrency(data.remainingBalance), amountX, yPosition + 0.5, { align: 'right' })

  // Footer - Centered on page with divider line
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.5)
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18)

  const footerText = 'Archon Construction LLC  ·  Teaneck, NJ  ·  Licensed & Insured          archonconstruction.co  ·  (551) 212-8820'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.secondary)
  doc.text(footerText, pageWidth / 2, pageHeight - 12, { align: 'center' })

  return doc
}

export function downloadInvoicePDF(data: InvoiceData, filename?: string) {
  const doc = generateInvoicePDF(data, filename)
  const finalFilename = filename || `invoice-${data.invoiceNumber}.pdf`
  doc.save(finalFilename)
}

export async function generateInvoicePDFBlob(data: InvoiceData): Promise<Blob> {
  const doc = generateInvoicePDF(data)
  const pdf = doc.output('blob')
  return pdf
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
