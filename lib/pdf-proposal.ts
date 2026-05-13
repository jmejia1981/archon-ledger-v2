/**
 * Professional PDF Proposal Generator - Archon Construction Template
 * Generates proposals matching the modern Archon Construction template design
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ProposalData {
  proposalNumber: string
  proposalDate: string
  expirationDate: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  projectName?: string
  projectAddress?: string
  projectCity?: string
  projectState?: string
  projectZip?: string
  companyName?: string
  companyEmail?: string
  companyPhone?: string
  logoImage?: string // Base64 encoded image or data URL
  lineItems: LineItemData[]
  subtotal: number
  tax?: number
  totalAmount: number
  terms?: string
  notes?: string
  scopeOfWork?: string[]
  inclusions?: string[]
  exclusions?: string[]
  validFor?: string // e.g., "30 Days from Date Issued"
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
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.darkText)

  // TITLE SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.primary)
  doc.text(data.projectName || 'PROPOSAL', pageWidth / 2, yPosition, { align: 'center' })

  yPosition += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.secondary)
  doc.text(data.projectAddress || '', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 6

  // TWO COLUMN SECTION: PROPOSAL DETAILS (left) and PROJECT LOCATION (right)
  const leftColumnX = margin
  const rightColumnX = margin + contentWidth * 0.52

  // PROPOSAL DETAILS (Left)
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

  // PROJECT LOCATION (Right)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  doc.text('PROJECT LOCATION', rightColumnX, yPosition)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  let locationY = yPosition + 5
  doc.text(`Address: ${data.projectAddress || 'N/A'}`, rightColumnX, locationY)
  locationY += 4
  const cityStateZip = [data.projectCity, data.projectState, data.projectZip]
    .filter(x => x)
    .join(', ')
  doc.text(`City/State/Zip: ${cityStateZip || 'N/A'}`, rightColumnX, locationY)

  yPosition += 28

  // SCOPE OF WORK SECTION
  if (data.scopeOfWork && data.scopeOfWork.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('SCOPE OF WORK', margin, yPosition)

    // Separator line under section title
    doc.setDrawColor(...COLORS.borderGray)
    doc.setLineWidth(0.2)
    doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.darkText)

    data.scopeOfWork.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 4)
      doc.text(lines, margin + 2, yPosition)
      yPosition += lines.length * 3.5 + 1
    })
    yPosition += 10
  }

  // INCLUSIONS SECTION
  if (data.inclusions && data.inclusions.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('INCLUSIONS', margin, yPosition)

    // Separator line under section title
    doc.setDrawColor(...COLORS.borderGray)
    doc.setLineWidth(0.2)
    doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.darkText)

    data.inclusions.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 4)
      doc.text(lines, margin + 2, yPosition)
      yPosition += lines.length * 3.5 + 1
    })
    yPosition += 2
  }

  // EXCLUSIONS SECTION
  if (data.exclusions && data.exclusions.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('EXCLUSIONS', margin, yPosition)

    // Separator line under section title
    doc.setDrawColor(...COLORS.borderGray)
    doc.setLineWidth(0.2)
    doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.darkText)

    data.exclusions.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, contentWidth - 4)
      doc.text(lines, margin + 2, yPosition)
      yPosition += lines.length * 3.5 + 1
    })
    yPosition += 3
  }

  // PRICING SUMMARY SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  doc.text('PRICING SUMMARY', margin, yPosition)

  // Separator line under section title
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.2)
  doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
  yPosition += 5

  // Pricing table
  const tableColumns = [
    { header: 'DESCRIPTION', dataKey: 'description' },
    { header: 'QTY', dataKey: 'quantity' },
    { header: 'AMOUNT', dataKey: 'amount' },
  ]

  const tableBody: any[] = []

  if (data.lineItems && data.lineItems.length > 0) {
    data.lineItems.forEach((item) => {
      tableBody.push({
        description: item.description,
        quantity: item.quantity.toString(),
        amount: formatCurrency(item.amount),
      })
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
      0: {
        halign: 'left',
        cellWidth: contentWidth * 0.6,
      },
      1: {
        halign: 'center',
        cellWidth: contentWidth * 0.15,
      },
      2: {
        halign: 'right',
        cellWidth: contentWidth * 0.25,
      },
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
    },
  })

  yPosition = (doc as any).lastAutoTable.finalY + 3

  // TOTAL CONTRACT PRICE ROW
  doc.setFillColor(...COLORS.accent)
  doc.rect(margin, yPosition, contentWidth, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)
  doc.text('TOTAL CONTRACT PRICE', margin + 2, yPosition + 4.5)
  doc.text(formatCurrency(data.totalAmount), pageWidth - margin - 2, yPosition + 4.5, { align: 'right' })

  yPosition += 14

  // TERMS & CONDITIONS SECTION
  if (data.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.primary)
    doc.text('TERMS & CONDITIONS', margin, yPosition)

    // Separator line under section title
    doc.setDrawColor(...COLORS.borderGray)
    doc.setLineWidth(0.2)
    doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
    yPosition += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.darkText)
    const termsLines = doc.splitTextToSize(data.terms, contentWidth)
    doc.text(termsLines, margin, yPosition)
    yPosition += termsLines.length * 3.5 + 5
  }

  // ACCEPTANCE OF PROPOSAL SECTION
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.primary)
  doc.text('ACCEPTANCE OF PROPOSAL', margin, yPosition)

  // Separator line under section title
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.2)
  doc.line(margin, yPosition + 1.5, pageWidth - margin, yPosition + 1.5)
  yPosition += 5

  // Acceptance text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)
  const acceptanceText = 'By signing below, the customer accepts this proposal and authorizes the contractor to proceed with the outlined scope of work at the agreed price.'
  const acceptanceLines = doc.splitTextToSize(acceptanceText, contentWidth)
  doc.text(acceptanceLines, margin, yPosition)
  yPosition += acceptanceLines.length * 3.5 + 5

  // Signature fields - two columns
  const signatureY = yPosition
  const leftColX = margin
  const rightColX = margin + contentWidth / 2 + 5

  // Customer Signature section
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.darkText)

  // Signature line
  doc.line(leftColX, signatureY, leftColX + contentWidth / 2 - 5, signatureY)
  doc.text('Customer Signature', leftColX, signatureY + 3)

  // Date field
  doc.line(leftColX, signatureY + 10, leftColX + contentWidth / 2 - 5, signatureY + 10)
  doc.text('Date', leftColX, signatureY + 13)

  // Contractor Signature section
  // Signature line
  doc.line(rightColX, signatureY, rightColX + contentWidth / 2 - 5, signatureY)
  doc.text('Contractor Signature', rightColX, signatureY + 3)

  // Date field
  doc.line(rightColX, signatureY + 10, rightColX + contentWidth / 2 - 5, signatureY + 10)
  doc.text('Date', rightColX, signatureY + 13)

  yPosition += 18

  // Thank you message
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.secondary)
  const thankYouText = 'Thank you for the opportunity to serve you. We look forward to completing this project to your satisfaction.'
  const thankYouLines = doc.splitTextToSize(thankYouText, contentWidth)
  doc.text(thankYouLines, pageWidth / 2, yPosition, { align: 'center' })

  // Footer
  doc.setDrawColor(...COLORS.borderGray)
  doc.setLineWidth(0.5)
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

  const footerText = 'Archon Construction LLC  ·  Teaneck, NJ  ·  Licensed & Insured          archonconstruction.co  ·  (551) 212-8820'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.secondary)
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' })

  return doc
}

export function downloadProposalPDF(data: ProposalData, filename?: string) {
  const doc = generateProposalPDF(data)
  const finalFilename = filename || `proposal-${data.proposalNumber}.pdf`
  doc.save(finalFilename)
}

export async function generateProposalPDFBlob(data: ProposalData): Promise<Blob> {
  const doc = generateProposalPDF(data)
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
