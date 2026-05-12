# Archon Ledger - Scheduled Task Automation Setup

This guide explains how to configure automated tasks for the Archon Ledger application, including invoice reminders, monthly reports, and project maintenance.

## Overview

The automation system includes the following tasks:

1. **Invoice Reminders** - Sends email reminders for due/overdue invoices daily
2. **Monthly Reports** - Generates and sends monthly financial reports to administrators
3. **Project Maintenance** - Checks upcoming project deadlines and archives completed projects

## Environment Variables

First, add these variables to your `.env.local` file:

```
# Scheduler Configuration
SCHEDULER_SECRET_KEY=your-secret-key-here

# Email Provider Configuration (choose one)
# Option 1: Resend
RESEND_API_KEY=your-resend-api-key

# Option 2: SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Option 3: SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password

# Application URL
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

### Generating a Scheduler Secret Key

Run this command to generate a secure random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Email Provider Setup

### Option 1: Resend (Recommended for Next.js)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

### Option 2: SendGrid

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Create an API key in Settings > API Keys
3. Add to `.env.local`:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

### Option 3: SMTP

Configure with your email provider's SMTP settings:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Setting Up Scheduled Tasks

### Option A: Vercel Cron (if deploying on Vercel)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/automation/invoice-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/automation/monthly-reports",
      "schedule": "0 8 1 * *"
    },
    {
      "path": "/api/automation/project-maintenance",
      "schedule": "0 10 * * MON"
    }
  ]
}
```

### Option B: External Cron Service (e.g., EasyCron, cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) or [easycron.com](https://www.easycron.com)
2. Create new cron jobs with these endpoints:

**Invoice Reminders** (Daily at 9 AM)
- URL: `https://yourapp.com/api/automation/invoice-reminders`
- Method: POST
- Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
- Schedule: `0 9 * * *` (9 AM daily)

**Monthly Reports** (1st of month at 8 AM)
- URL: `https://yourapp.com/api/automation/monthly-reports`
- Method: POST
- Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
- Schedule: `0 8 1 * *` (1st of every month at 8 AM)

**Project Maintenance** (Mondays at 10 AM)
- URL: `https://yourapp.com/api/automation/project-maintenance`
- Method: POST
- Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
- Schedule: `0 10 * * MON` (Every Monday at 10 AM)

### Option C: Node.js Scheduler (Local Development)

If you want to run tasks locally for testing, create `lib/scheduler.ts`:

```typescript
import cron from 'node-cron'

// Note: Install node-cron first: npm install node-cron

export function initializeScheduler() {
  const secretKey = process.env.SCHEDULER_SECRET_KEY

  // Invoice reminders - Daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    await fetch('http://localhost:3000/api/automation/invoice-reminders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })
  })

  // Monthly reports - 1st of month at 8 AM
  cron.schedule('0 8 1 * *', async () => {
    await fetch('http://localhost:3000/api/automation/monthly-reports', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })
  })

  // Project maintenance - Mondays at 10 AM
  cron.schedule('0 10 * * MON', async () => {
    await fetch('http://localhost:3000/api/automation/project-maintenance', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    })
  })

  console.log('Scheduler initialized')
}
```

Then call this in your application startup (e.g., in a custom server file).

## Cron Expression Format

All cron expressions use the standard 5-field format:

```
minute hour day-of-month month day-of-week
```

Examples:
- `0 9 * * *` - Daily at 9:00 AM
- `0 8 1 * *` - 1st of every month at 8:00 AM
- `0 10 * * MON` - Every Monday at 10:00 AM
- `*/15 * * * *` - Every 15 minutes
- `0 0 * * *` - Daily at midnight

## Testing the Automation

### Test Invoice Reminders

```bash
curl -X POST https://yourapp.com/api/automation/invoice-reminders \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY" \
  -H "Content-Type: application/json"
```

### Test Monthly Reports

```bash
curl -X POST https://yourapp.com/api/automation/monthly-reports \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY" \
  -H "Content-Type: application/json"
```

### Test Project Maintenance

```bash
curl -X POST https://yourapp.com/api/automation/project-maintenance \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY" \
  -H "Content-Type: application/json"
```

## What Each Task Does

### Invoice Reminders (`/api/automation/invoice-reminders`)

- **Frequency**: Recommended daily (9 AM)
- **Actions**:
  1. Checks all invoices with due date before today
  2. Updates invoices older than due date to "overdue" status
  3. Sends email reminders to clients with:
     - Overdue invoices (red alert)
     - Invoices due within next 3 days (blue reminder)
  4. Includes direct link to invoice payment page

### Monthly Reports (`/api/automation/monthly-reports`)

- **Frequency**: Recommended monthly (1st of month)
- **Actions**:
  1. Generates report for previous month
  2. Calculates key metrics:
     - Total invoiced amount
     - Total payments received
     - Total expenses
     - Net profit and profit margin
     - Invoice counts (issued, paid, pending)
  3. Sends formatted email report to all administrators

### Project Maintenance (`/api/automation/project-maintenance`)

- **Frequency**: Recommended weekly (Monday)
- **Actions**:
  1. Checks for projects with completion dates in next 7 days
  2. Logs upcoming deadline notifications
  3. Archives completed projects older than 30 days
  4. Updates `is_archived` field for old completed projects

## Monitoring and Troubleshooting

### Check Logs

All automation tasks log their output. In development, check your terminal. In production, check your hosting provider's logs.

### Manual Trigger

You can manually trigger any automation task:

```bash
# From command line
curl -X POST YOUR_APP_URL/api/automation/invoice-reminders \
  -H "Authorization: Bearer $SCHEDULER_SECRET_KEY"
```

### Common Issues

**"Unauthorized" error**
- Verify `SCHEDULER_SECRET_KEY` is set correctly
- Check Authorization header format: `Bearer {key}`

**"No email provider configured"**
- Ensure at least one email provider env var is set (RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_*)

**Emails not sending**
- Check email provider credentials
- Verify sender email address matches provider configuration
- Check SPAM folder

**Database connection errors**
- Verify Supabase credentials in environment
- Check database connection limits
- Ensure RLS policies allow automation service account

## Database Schema Requirements

Ensure your database has these fields (automatically created if using migrations):

### invoices table
- `id` (uuid, pk)
- `invoice_number` (string)
- `due_date` (timestamp)
- `status` (string: pending, paid, overdue, cancelled)
- `amount_paid` (numeric)
- `invoice_amount` (numeric)
- `client_id` (uuid, fk)
- `updated_at` (timestamp)

### clients table
- `id` (uuid, pk)
- `name` (string)
- `email` (string)

### projects table
- `id` (uuid, pk)
- `project_name` (string)
- `completion_date` (timestamp)
- `status` (string)
- `is_archived` (boolean, default: false)
- `updated_at` (timestamp)

### expenses table
- `id` (uuid, pk)
- `amount` (numeric)
- `expense_date` (timestamp)

## Best Practices

1. **Secret Key Management**
   - Keep `SCHEDULER_SECRET_KEY` secret
   - Rotate quarterly
   - Use strong random keys

2. **Email Configuration**
   - Start with Resend for simplicity
   - Test with dry-run before production
   - Monitor email delivery rates

3. **Scheduling**
   - Spread tasks across different times to avoid overload
   - Run report generation during low-traffic hours
   - Use weekly schedules for expensive operations

4. **Monitoring**
   - Check automation logs regularly
   - Set up alerts for failed tasks
   - Monitor email delivery

5. **Data Cleanup**
   - Regularly archive completed projects
   - Clean up old notifications
   - Archive historical data quarterly

## Support

For issues or questions:
1. Check application logs
2. Verify environment variables
3. Test API endpoints manually
4. Check email provider's dashboard for delivery status
