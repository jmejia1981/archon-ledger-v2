/**
 * Professional PDF Proposal Generator - Archon Construction Template
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ProposalData {
  proposalNumber: string
  proposalDate: string
  expirationDate: string
  clientName: string
  clientCompany?: string
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
  projectZip?: string
  companyName?: string
  companyEmail?: string
  companyPhone?: string
  companyAddress?: string
  companyCity?: string
  companyState?: string
  companyZip?: string
  logoImage?: string
  lineItems: LineItemData[]
  subtotal: number
  tax?: number
  totalAmount: number
  terms?: string
  notes?: string
  scopeOfWork?: string[]
  inclusions?: string[]
  exclusions?: string[]
  validFor?: string
}

interface LineItemData {
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

const COLORS: { [key: string]: [number, number, number] } = {
  primary: [26, 58, 107],
  secondary: [143, 163, 184],
  lightBg: [245, 248, 252],
  darkText: [33, 47, 61],
  borderGray: [200, 210, 220],
  accent: [200, 184, 154],
  white: [255, 255, 255],
}

export function generateProposalPDF(data: ProposalData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - 2 * margin
  const footerHeight = 18   // reserved at bottom of every page
  const usableBottom = pageHeight - footerHeight
  let yPosition = margin

  // ── Helpers ────────────────────────────────────────────────────────────────

  const addFooter = () => {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(...COLORS.borderGray)
      doc.setLineWidth(0.5)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
      const footerText = 'Archon Construction LLC  ·  Teaneck, NJ  ·  Licensed & Insured          archonconstruction.co  ·  (551) 212-8820'
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.secondary)
      doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }
  }

  // Add a new page and reset yPosition with optional header banner
  const addNewPage = () => {
    doc.addPage()
    yPosition = margin + 5
    // Repeat header image on new pages if available
    if (data.logoImage) {
      try {
        doc.addImage(data.logoImage, 'PNG', 0, 0, pageWidth, 15)
        yPosition = 22
      } catch (_) {}
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.darkText)
  }

  // Check if `needed` mm fits on the current page; add a new one if not
  const checkPageBreak = (needed: number) => {
    if (yPosition + needed > usableBottom) {
      addNewPage()
    }
  }

  // Draw a section header with separator line (returns height consumed)
  const drawSectionHeader = (title: string): number => {
    checkPageBreak(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text(title, margin, yPosition)
    doc.setDrawColor(...COLORS.borderGray)
    doc.setLineWidth(0.2)
    doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
    yPosition += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.darkText)
    return 5
  }

  // Draw a bullet list; handles page breaks mid-list
  const drawBulletList = (items: string[]) => {
    items.forEach((item) => {
      const lines = doc.splitTextToSize(item, contentWidth - 4)
      const lineHeight = lines.length * 3.5 + 1
      checkPageBreak(lineHeight)
      doc.text(lines, margin + 2, yPosition)
      yPosition += lineHeight
    })
  }

  // ── Page 1 header ──────────────────────────────────────────────────────────

  if (data.logoImage) {
    try {
      doc.addImage(data.logoImage, 'PNG', 0, 0, pageWidth, 15)
      yPosition = 27
    } catch (error) {
      console.error('Error adding header image:', error)
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.primary)
  doc.text(data.projectName || 'PROPOSAL', pageWidth / 2, yPosition, { align: 'center' })

  yPosition += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.secondary)
  doc.text(data.projectAddress || '', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8

  // ── Letter-format contact block ────────────────────────────────────────────
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.2)
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 5

  const leftColumnX = margin
  const rightColumnX = margin + contentWidth * 0.52

  // FROM — company
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)
  doc.text('FROM', leftColumnX, yPosition)

  // TO — client
  doc.text('PREPARED FOR', rightColumnX, yPosition)
  yPosition += 4

  // Use passed data or fall back to hardcoded Archon defaults
  const resolvedCompanyName = data.companyName || 'Archon Construction LLC'
  const resolvedCompanyPhone = data.companyPhone || '(551) 212-8820'
  const resolvedCompanyEmail = data.companyEmail || 'info@archonconstruction.co'
  const resolvedCompanyAddr = data.companyAddress
    ? [data.companyAddress, data.companyCity, data.companyState, data.companyZip].filter(Boolean).join(', ')
    : '656 Grant Terrace, Teaneck, NJ 07666'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)
  doc.text(resolvedCompanyName, leftColumnX, yPosition)
  doc.text(data.clientName, rightColumnX, yPosition)
  yPosition += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  let fromY = yPosition
  let toY = yPosition

  // Only show company name if it differs from client name
  if (data.clientCompany && data.clientCompany.trim().toLowerCase() !== data.clientName.trim().toLowerCase()) {
    doc.setFont('helvetica', 'italic')
    doc.text(data.clientCompany, rightColumnX, toY)
    doc.setFont('helvetica', 'normal')
    toY += 4
  }

  doc.text(resolvedCompanyPhone, leftColumnX, fromY)
  fromY += 4
  doc.text(resolvedCompanyEmail, leftColumnX, fromY)
  fromY += 4
  doc.text(resolvedCompanyAddr, leftColumnX, fromY)
  fromY += 4

  if (data.clientEmail) {
    doc.text(data.clientEmail, rightColumnX, toY)
    toY += 4
  }
  if (data.clientPhone) {
    doc.text(data.clientPhone, rightColumnX, toY)
    toY += 4
  }
  const clientAddrLine = [data.clientAddress, data.clientCity, data.clientState, data.clientZip].filter(Boolean).join(', ')
  if (clientAddrLine) {
    doc.text(clientAddrLine, rightColumnX, toY)
    toY += 4
  }

  yPosition = Math.max(fromY, toY) + 3
  doc.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  doc.text('PROPOSAL DETAILS', leftColumnX, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  let detailY = yPosition + 5
  doc.text(`Date: ${formatDate(data.proposalDate)}`, leftColumnX, detailY)
  detailY += 4
  const proposalNumberDisplay = data.proposalNumber.startsWith('PROP-')
    ? data.proposalNumber
    : `PROP-${data.proposalNumber}`
  doc.text(`Proposal #: ${proposalNumberDisplay}`, leftColumnX, detailY)
  detailY += 4
  doc.text(`Valid For: ${data.validFor || '30 Days from Date Issued'}`, leftColumnX, detailY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  doc.text('PROJECT LOCATION', rightColumnX, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  let locationY = yPosition + 5
  if (data.projectAddress) {
    doc.text(data.projectAddress, rightColumnX, locationY)
    locationY += 4
  }
  const cityStateZip = [data.projectCity, data.projectState, data.projectZip].filter(Boolean).join(', ')
  if (cityStateZip) {
    doc.text(cityStateZip, rightColumnX, locationY)
  }

  yPosition += 28

  // ── Sections ───────────────────────────────────────────────────────────────

  if (data.scopeOfWork && data.scopeOfWork.length > 0) {
    drawSectionHeader('SCOPE OF WORK')
    drawBulletList(data.scopeOfWork)
    yPosition += 6
  }

  if (data.inclusions && data.inclusions.length > 0) {
    drawSectionHeader('INCLUSIONS')
    drawBulletList(data.inclusions)
    yPosition += 4
  }

  if (data.exclusions && data.exclusions.length > 0) {
    drawSectionHeader('EXCLUSIONS')
    drawBulletList(data.exclusions)
    yPosition += 4
  }

  // ── Pricing table ──────────────────────────────────────────────────────────

  checkPageBreak(20)
  drawSectionHeader('PRICING SUMMARY')

  const tableColumns = [
    { header: 'DESCRIPTION', dataKey: 'description' },
    { header: 'QTY', dataKey: 'quantity' },
    { header: 'AMOUNT', dataKey: 'amount' },
  ]

  const tableBody: any[] = (data.lineItems || []).map((item) => ({
    description: item.description,
    quantity: item.quantity.toString(),
    amount: formatCurrency(item.amount),
  }))

  autoTable(doc, {
    columns: tableColumns,
    body: tableBody,
    startY: yPosition,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.darkText,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      lineColor: COLORS.accent,
      lineWidth: 0.5,
      font: 'helvetica',
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2.5,
      textColor: COLORS.darkText,
      lineColor: COLORS.borderGray,
      lineWidth: 0.3,
      fillColor: [255, 255, 255],
      font: 'helvetica',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: contentWidth * 0.6 },
      1: { halign: 'center', cellWidth: contentWidth * 0.15 },
      2: { halign: 'right', cellWidth: contentWidth * 0.25 },
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
    },
    // Respect our usable area so autoTable doesn't overlap the footer
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  })

  yPosition = (doc as any).lastAutoTable.finalY + 3

  // Total contract price row
  checkPageBreak(10)
  doc.setFillColor(...COLORS.accent)
  doc.rect(margin, yPosition, contentWidth, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)
  doc.text('TOTAL CONTRACT PRICE', margin + 2, yPosition + 4.5)
  doc.text(formatCurrency(data.totalAmount), pageWidth - margin - 2, yPosition + 4.5, { align: 'right' })
  yPosition += 14

  // ── Terms ──────────────────────────────────────────────────────────────────

  if (data.terms) {
    drawSectionHeader('TERMS & CONDITIONS')
    const termsLines = doc.splitTextToSize(data.terms, contentWidth)
    // Draw line by line with page break checks
    termsLines.forEach((line: string) => {
      checkPageBreak(4)
      doc.text(line, margin, yPosition)
      yPosition += 3.5
    })
    yPosition += 5
  }

  // ── Acceptance / Signature ─────────────────────────────────────────────────

  // Keep the whole acceptance block together (signature needs ~40mm)
  checkPageBreak(50)
  drawSectionHeader('ACCEPTANCE OF PROPOSAL')

  const acceptanceText = 'By signing below, the customer accepts this proposal and authorizes the contractor to proceed with the outlined scope of work at the agreed price.'
  const acceptanceLines = doc.splitTextToSize(acceptanceText, contentWidth)
  doc.text(acceptanceLines, margin, yPosition)
  yPosition += acceptanceLines.length * 3.5 + 5

  const signatureY = yPosition
  const leftColX = margin
  const rightColX = margin + contentWidth / 2 + 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  doc.line(leftColX, signatureY, leftColX + contentWidth / 2 - 5, signatureY)
  doc.text('Customer Signature', leftColX, signatureY + 3)
  doc.line(leftColX, signatureY + 10, leftColX + contentWidth / 2 - 5, signatureY + 10)
  doc.text('Date', leftColX, signatureY + 13)

  doc.line(rightColX, signatureY, rightColX + contentWidth / 2 - 5, signatureY)
  doc.text('Contractor Signature', rightColX, signatureY + 3)
  doc.line(rightColX, signatureY + 10, rightColX + contentWidth / 2 - 5, signatureY + 10)
  doc.text('Date', rightColX, signatureY + 13)

  yPosition += 22

  // ── Thank you ──────────────────────────────────────────────────────────────

  checkPageBreak(12)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.secondary)
  const thankYouText = 'Thank you for the opportunity to serve you. We look forward to completing this project to your satisfaction.'
  const thankYouLines = doc.splitTextToSize(thankYouText, contentWidth)
  doc.text(thankYouLines, pageWidth / 2, yPosition, { align: 'center' })

  // ── Footer on all pages ────────────────────────────────────────────────────
  addFooter()

  return doc
}

export function downloadProposalPDF(data: ProposalData, filename?: string) {
  const doc = generateProposalPDF(data)
  doc.save(filename || `proposal-${data.proposalNumber}.pdf`)
}

export async function generateProposalPDFBlob(data: ProposalData): Promise<Blob> {
  const doc = generateProposalPDF(data)
  return doc.output('blob')
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
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
