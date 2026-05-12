/**
 * Invoice Email Service
 * Handles sending invoices and payment reminders
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

/**
 * Send email using Resend, SendGrid, or SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_PASSWORD
  const from = options.from || 'invoices@archon-construction.com'

  try {
    // Try Resend first
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        }),
      })

      if (response.ok) {
        console.log(`Email sent successfully to ${options.to}`)
        return true
      }
    }

    // Try SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: from },
          subject: options.subject,
          content: [{ type: 'text/html', value: options.html }],
        }),
      })

      if (response.ok || response.status === 202) {
        console.log(`Email sent successfully to ${options.to}`)
        return true
      }
    }

    console.warn('No email provider configured')
    return false
  } catch (error) {
    console.error('Error sending email:', error)
    return false
  }
}

/**
 * Generate invoice email template
 */
export function generateInvoiceEmailTemplate(
  invoiceNumber: string,
  clientName: string,
  amount: number,
  dueDate: string,
  paymentLink?: string
): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1A3A6B 0%, #2D5A8C 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .invoice-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: 600; color: #1A3A6B; }
          .amount-due { font-size: 24px; color: #C8B89A; font-weight: bold; }
          .button { background: #1A3A6B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice ${invoiceNumber}</h1>
            <p>Archon Construction</p>
          </div>

          <div class="content">
            <p>Hello ${clientName},</p>

            <p>We've sent you an invoice for services rendered. Please find the details below:</p>

            <div class="invoice-details">
              <div class="detail-row">
                <span class="label">Invoice Number:</span>
                <span class="value">${invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="label">Amount Due:</span>
                <span class="value amount-due">${formattedAmount}</span>
              </div>
              <div class="detail-row">
                <span class="label">Due Date:</span>
                <span class="value">${formattedDueDate}</span>
              </div>
            </div>

            <p>To pay this invoice online, click the button below:</p>
            ${
              paymentLink
                ? `<a href="${paymentLink}" class="button">Pay Now</a>`
                : '<p style="color: #999;">Please contact us to arrange payment.</p>'
            }

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your business!</p>
            <p>Archon Construction</p>
          </div>

          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Archon Construction. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Generate payment reminder email template
 */
export function generatePaymentReminderTemplate(
  invoiceNumber: string,
  clientName: string,
  amount: number,
  dueDate: string,
  isOverdue: boolean,
  paymentLink?: string
): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

  const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const reminderType = isOverdue ? 'OVERDUE PAYMENT NOTICE' : 'PAYMENT REMINDER'
  const reminderColor = isOverdue ? '#d32f2f' : '#1976d2'

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${reminderColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .alert { background: ${reminderColor}; color: white; padding: 15px; border-radius: 4px; margin-bottom: 20px; font-weight: 600; }
          .invoice-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: 600; color: #1A3A6B; }
          .amount-due { font-size: 24px; color: ${reminderColor}; font-weight: bold; }
          .button { background: ${reminderColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; border-top: 1px solid #ddd; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${reminderType}</h1>
            <p>Invoice ${invoiceNumber}</p>
          </div>

          <div class="content">
            <div class="alert">
              ${isOverdue ? 'This invoice is now overdue. Please remit payment immediately.' : 'This invoice will be due soon. Please arrange payment at your earliest convenience.'}
            </div>

            <p>Hello ${clientName},</p>

            <p>${isOverdue ? 'Our records show that the following invoice remains unpaid.' : 'We wanted to remind you that the following invoice will be due soon:'}</p>

            <div class="invoice-details">
              <div class="detail-row">
                <span class="label">Invoice Number:</span>
                <span class="value">${invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="label">Amount Due:</span>
                <span class="value amount-due">${formattedAmount}</span>
              </div>
              <div class="detail-row">
                <span class="label">Due Date:</span>
                <span class="value">${formattedDueDate}</span>
              </div>
            </div>

            <p>Please pay this invoice at your earliest convenience to avoid late fees.</p>
            ${
              paymentLink
                ? `<a href="${paymentLink}" class="button">Pay Now</a>`
                : '<p style="color: #999;">Please contact us to arrange payment.</p>'
            }

            <p>If you have already made this payment, please disregard this notice. Thank you!</p>

            <p>Archon Construction</p>
          </div>

          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; 2024 Archon Construction. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `
}
