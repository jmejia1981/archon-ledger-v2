// PDF Generator utility for invoice export
// This creates a printable HTML version that can be saved as PDF using browser's print-to-PDF

export function generateInvoicePDF({
  invoice,
  client,
  project,
}: {
  invoice: any
  client: any
  project?: any
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const total = invoice.invoice_amount + (invoice.tax || 0) - (invoice.retainage || 0)
  const outstanding = total - invoice.amount_paid

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px;
          background: white;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 3px solid #1A3A6B;
        }

        .company-info h1 {
          margin: 0 0 10px 0;
          color: #1A3A6B;
          font-size: 28px;
          font-weight: bold;
        }

        .company-info p {
          margin: 3px 0;
          color: #666;
          font-size: 12px;
          line-height: 1.5;
        }

        .invoice-meta {
          text-align: right;
        }

        .invoice-meta h2 {
          margin: 0 0 15px 0;
          color: #1A3A6B;
          font-size: 36px;
          font-weight: bold;
        }

        .invoice-meta-row {
          display: flex;
          justify-content: flex-end;
          gap: 30px;
          margin-bottom: 5px;
        }

        .invoice-meta-item {
          font-size: 12px;
        }

        .invoice-meta-item strong {
          color: #1A3A6B;
          display: block;
          margin-bottom: 2px;
        }

        .details {
          display: flex;
          gap: 60px;
          margin-bottom: 40px;
        }

        .detail-section {
          flex: 1;
        }

        .detail-section h3 {
          margin: 0 0 10px 0;
          color: #1A3A6B;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-section p {
          margin: 4px 0;
          color: #333;
          font-size: 13px;
          line-height: 1.6;
        }

        .table-wrapper {
          margin-bottom: 30px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        table thead {
          background-color: #f0f0f0;
          border-top: 2px solid #1A3A6B;
          border-bottom: 2px solid #1A3A6B;
        }

        table th {
          padding: 12px;
          text-align: left;
          color: #1A3A6B;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        table td {
          padding: 12px;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }

        table tr:last-child td {
          border-bottom: none;
        }

        .text-right {
          text-align: right;
        }

        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }

        .totals {
          width: 320px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
          font-size: 13px;
        }

        .total-row.grand-total {
          border-top: 2px solid #1A3A6B;
          border-bottom: 2px solid #1A3A6B;
          font-weight: bold;
          color: #1A3A6B;
          font-size: 15px;
          padding: 12px 0;
        }

        .total-row.outstanding {
          color: #d32f2f;
          font-weight: bold;
        }

        .total-row.outstanding.positive {
          color: #d32f2f;
        }

        .total-row.outstanding.paid {
          color: #2e7d32;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          background-color: #e8f5e9;
          color: #2e7d32;
          border-radius: 3px;
          font-size: 11px;
          font-weight: bold;
          text-transform: capitalize;
        }

        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #666;
        }

        .footer p {
          margin: 5px 0;
        }

        .no-print {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }

        .no-print button {
          background-color: #1A3A6B;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-right: 10px;
        }

        .no-print button:hover {
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1>BuildRight Construction</h1>
            <p>123 Construction Ave</p>
            <p>Building City, ST 12345</p>
            <p>Phone: (555) 123-4567</p>
            <p>Email: info@buildright.com</p>
            <p>Tax ID: 12-3456789</p>
          </div>

          <div class="invoice-meta">
            <h2>INVOICE</h2>
            <div class="invoice-meta-row">
              <div class="invoice-meta-item">
                <strong>Invoice Number</strong>
                ${invoice.invoice_number}
              </div>
              <div class="invoice-meta-item">
                <strong>Invoice Date</strong>
                ${formatDate(invoice.invoice_date)}
              </div>
            </div>
            <div class="invoice-meta-row">
              <div class="invoice-meta-item">
                <strong>Due Date</strong>
                ${formatDate(invoice.due_date)}
              </div>
              <div class="invoice-meta-item">
                <strong>Status</strong>
                <span class="status-badge">${invoice.status}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Details -->
        <div class="details">
          <div class="detail-section">
            <h3>Bill To</h3>
            <p><strong>${client.name}</strong></p>
            ${client.company_name ? `<p>${client.company_name}</p>` : ''}
            ${client.email ? `<p>${client.email}</p>` : ''}
            ${client.phone ? `<p>${client.phone}</p>` : ''}
            ${client.address ? `<p>${client.address}</p>` : ''}
          </div>

          <div class="detail-section">
            <h3>Project Information</h3>
            ${project ? `
              <p><strong>${project.project_name}</strong></p>
              <p>Project #: ${project.project_number || 'N/A'}</p>
            ` : '<p>—</p>'}
          </div>

          <div class="detail-section">
            <h3>Invoice Details</h3>
            <p><strong>Payment Terms:</strong> ${invoice.payment_terms}</p>
          </div>
        </div>

        <!-- Line Items -->
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${project ? `Project: ${project.project_name}` : 'Invoice Amount'}</td>
                <td class="text-right">${formatCurrency(invoice.invoice_amount)}</td>
              </tr>
              ${invoice.tax ? `
              <tr>
                <td>Tax (${((invoice.tax / invoice.invoice_amount) * 100).toFixed(1)}%)</td>
                <td class="text-right">${formatCurrency(invoice.tax)}</td>
              </tr>
              ` : ''}
              ${invoice.retainage ? `
              <tr>
                <td>Retainage</td>
                <td class="text-right">-${formatCurrency(invoice.retainage)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="totals-section">
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatCurrency(invoice.invoice_amount)}</span>
            </div>
            ${invoice.tax ? `
            <div class="total-row">
              <span>Tax:</span>
              <span>${formatCurrency(invoice.tax)}</span>
            </div>
            ` : ''}
            ${invoice.retainage ? `
            <div class="total-row">
              <span>Retainage:</span>
              <span>-${formatCurrency(invoice.retainage)}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total Due:</span>
              <span>${formatCurrency(total)}</span>
            </div>
            <div class="total-row">
              <span>Amount Paid:</span>
              <span>${formatCurrency(invoice.amount_paid)}</span>
            </div>
            <div class="total-row outstanding ${outstanding > 0 ? 'positive' : 'paid'}">
              <span>Outstanding:</span>
              <span>${formatCurrency(outstanding)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>For questions about this invoice, please contact BuildRight Construction</p>
          <p style="font-size: 11px; color: #999; margin-top: 20px;">
            Invoice generated on ${formatDate(new Date().toISOString())}
          </p>
        </div>

        <!-- Print Controls -->
        <div class="no-print">
          <button onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button onclick="window.close()">✕ Close</button>
        </div>
      </div>
    </body>
    </html>
  `

  return html
}

export function downloadInvoicePDF(invoice: any, client: any, project?: any) {
  const html = generateInvoicePDF({ invoice, client, project })
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${invoice.invoice_number}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function openInvoicePDF(invoice: any, client: any, project?: any) {
  const html = generateInvoicePDF({ invoice, client, project })
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  window.open(url, `invoice-${invoice.invoice_number}`)
}
