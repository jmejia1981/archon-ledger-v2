# Quick Start: Scheduled Task Automation

This is a quick reference guide to get automation up and running. For detailed setup instructions, see `AUTOMATION_SETUP.md`.

## 5-Minute Setup

### Step 1: Generate Secret Key

```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (e.g., `a3f7b8c2d1e9f4a6b5c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8`)

### Step 2: Add to `.env.local`

```bash
# Copy .env.example to .env.local
cp .env.example .env.local
```

Then edit `.env.local` and add:

```
SCHEDULER_SECRET_KEY=your-copied-key-here
RESEND_API_KEY=your-resend-api-key-here
```

### Step 3: Choose Your Scheduler

**Option A: Vercel (Easiest if using Vercel)**

Create/update `vercel.json`:

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

Deploy and you're done!

**Option B: External Service (Works anywhere)**

Sign up at [cron-job.org](https://cron-job.org) or [easycron.com](https://www.easycron.com)

Add 3 cron jobs:

1. **Invoice Reminders**
   - URL: `https://yourapp.com/api/automation/invoice-reminders`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
   - Schedule: `0 9 * * *` (9 AM daily)

2. **Monthly Reports**
   - URL: `https://yourapp.com/api/automation/monthly-reports`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
   - Schedule: `0 8 1 * *` (1st of month, 8 AM)

3. **Project Maintenance**
   - URL: `https://yourapp.com/api/automation/project-maintenance`
   - Method: POST
   - Headers: `Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY`
   - Schedule: `0 10 * * MON` (Monday, 10 AM)

### Step 4: Test It

```bash
# From terminal
curl -X POST http://localhost:3000/api/automation/invoice-reminders \
  -H "Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY" \
  -H "Content-Type: application/json"
```

Or use the **Automation** page in the dashboard to test with a UI.

## Email Provider Setup

### Resend (Recommended)

1. Go to [resend.com](https://resend.com) and sign up
2. Create API key in dashboard
3. Add to `.env.local`: `RESEND_API_KEY=re_xxxxx`

### SendGrid

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Create API key in Settings
3. Add to `.env.local`: `SENDGRID_API_KEY=SG.xxxxx`

### SMTP (Gmail, Outlook, etc.)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## What Gets Automated

### 1. Invoice Reminders (Daily 9 AM)
- Marks overdue invoices with "overdue" status
- Sends email to clients with:
  - Invoices overdue
  - Invoices due within 3 days
- Includes direct payment link

### 2. Monthly Reports (1st of month, 8 AM)
- Generates report for previous month
- Sends email with:
  - Total invoiced amount
  - Total paid
  - Expenses
  - Profit & profit margin
  - Invoice counts
- Sent to all admin accounts

### 3. Project Maintenance (Mondays, 10 AM)
- Lists projects due within 7 days
- Archives completed projects older than 30 days
- Updates database status

## Troubleshooting

**Error: "Unauthorized"**
- Check `SCHEDULER_SECRET_KEY` matches between `.env.local` and scheduler
- Ensure Authorization header format: `Bearer {key}`

**Error: "No email provider configured"**
- Set one of: `RESEND_API_KEY`, `SENDGRID_API_KEY`, or `SMTP_*` variables
- Restart Next.js dev server after adding env vars

**Emails not received**
- Check SPAM/promotions folder
- Verify email provider credentials
- Check provider dashboard for delivery failures

**Task not running**
- Verify scheduler is sending requests
- Check server logs for errors
- Manually trigger task via curl to test

## Next Steps

- View automation tasks in Dashboard → Automation
- Read `AUTOMATION_SETUP.md` for advanced configuration
- Set up monitoring/alerts with your hosting provider
- Test each automation task manually first

## Support

Issues? Check:
1. `.env.local` has all required variables
2. Email provider credentials are correct
3. Scheduler service is running and sending requests
4. Database connection is working
5. Server logs show no errors
