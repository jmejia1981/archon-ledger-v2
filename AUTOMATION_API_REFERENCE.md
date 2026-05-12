# Automation API Reference

Complete API documentation for the Archon Ledger automation endpoints.

## Base URL

```
https://yourapp.com/api/automation
```

## Authentication

All endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer YOUR_SCHEDULER_SECRET_KEY
```

## Endpoints

### 1. Invoice Reminders

**Endpoint:** `POST /api/automation/invoice-reminders`

**Description:** Updates overdue invoice statuses and sends email reminders

**Schedule:** Daily at 9:00 AM (recommended)

**Request:**
```bash
POST /api/automation/invoice-reminders HTTP/1.1
Host: yourapp.com
Authorization: Bearer your-secret-key
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "overdueCheck": {
    "success": true,
    "overdueCount": 3,
    "invoices": [
      {
        "id": "uuid",
        "invoice_number": "INV-00001",
        "due_date": "2026-04-15",
        "status": "overdue",
        "amount_paid": 0,
        "invoice_amount": 5000,
        "client_id": "uuid",
        "clients": {
          "name": "Acme Corp",
          "email": "billing@acme.com"
        }
      }
    ]
  },
  "reminders": {
    "success": true,
    "remindersSent": 5,
    "reminders": [
      {
        "invoiceId": "uuid",
        "invoiceNumber": "INV-00001",
        "reminderType": "overdue",
        "sentAt": "2026-05-09T14:30:00Z"
      }
    ]
  },
  "timestamp": "2026-05-09T14:30:00Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

---

### 2. Monthly Reports

**Endpoint:** `POST /api/automation/monthly-reports`

**Description:** Generates and sends monthly financial reports

**Schedule:** 1st of every month at 8:00 AM (recommended)

**Request:**
```bash
POST /api/automation/monthly-reports HTTP/1.1
Host: yourapp.com
Authorization: Bearer your-secret-key
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "result": {
    "success": true,
    "reportsSent": 2,
    "reports": [
      {
        "userId": "uuid",
        "email": "admin@yourcompany.com",
        "month": "2026-04-01",
        "sentAt": "2026-05-01T08:00:00Z"
      }
    ]
  },
  "timestamp": "2026-05-01T08:00:00Z"
}
```

**Report Content (Email):**
- Previous month date
- Total invoiced amount
- Total paid amount
- Total expenses
- Net profit
- Profit margin percentage
- Invoice count (total, paid, pending)

---

### 3. Project Maintenance

**Endpoint:** `POST /api/automation/project-maintenance`

**Description:** Checks project deadlines and archives completed projects

**Schedule:** Mondays at 10:00 AM (recommended)

**Request:**
```bash
POST /api/automation/project-maintenance HTTP/1.1
Host: yourapp.com
Authorization: Bearer your-secret-key
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "deadlines": {
    "success": true,
    "upcomingDeadlines": 2,
    "projects": [
      {
        "projectId": "uuid",
        "projectName": "Office Renovation",
        "client": "Acme Corp",
        "completionDate": "2026-05-15",
        "daysRemaining": 6
      }
    ]
  },
  "archived": {
    "success": true,
    "archivedCount": 1
  },
  "timestamp": "2026-05-12T10:00:00Z"
}
```

---

## Testing

### Using cURL

Test invoice reminders:
```bash
curl -X POST https://yourapp.com/api/automation/invoice-reminders \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json"
```

Test monthly reports:
```bash
curl -X POST https://yourapp.com/api/automation/monthly-reports \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json"
```

Test project maintenance:
```bash
curl -X POST https://yourapp.com/api/automation/project-maintenance \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json"
```

### Using JavaScript/Fetch

```javascript
const secretKey = 'your-secret-key'

async function runAutomation(taskId) {
  const response = await fetch(`/api/automation/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

// Usage
const result = await runAutomation('invoice-reminders')
console.log(result)
```

### Using Python

```python
import requests

SECRET_KEY = 'your-secret-key'
BASE_URL = 'https://yourapp.com/api/automation'

headers = {
    'Authorization': f'Bearer {SECRET_KEY}',
    'Content-Type': 'application/json'
}

response = requests.post(f'{BASE_URL}/invoice-reminders', headers=headers)
print(response.json())
```

## Error Responses

### 401 Unauthorized

Missing or invalid Authorization header:
```json
{
  "error": "Unauthorized"
}
```

### 500 Internal Server Error

Server error during task execution:
```json
{
  "error": "Failed to send invoice reminders",
  "details": "Error message here"
}
```

## Rate Limiting

No built-in rate limiting is implemented. Consider adding rate limiting based on your hosting provider's capabilities:

- **Vercel:** Built-in rate limiting via deployment
- **Self-hosted:** Implement middleware to limit requests per IP
- **CloudFlare:** Use WAF rules for rate limiting

## Retry Logic

If a task fails:
1. Log the error
2. Retry after exponential backoff
3. Alert administrator if multiple retries fail

Example retry configuration for external schedulers:
- Retry interval: 5 minutes
- Max retries: 3
- Backoff: exponential

## Database Requirements

### Invoices Table
Required columns for invoice reminders:
- `id` (uuid, primary key)
- `invoice_number` (string)
- `due_date` (timestamp)
- `status` (string)
- `amount_paid` (numeric)
- `invoice_amount` (numeric)
- `client_id` (uuid, foreign key)
- `updated_at` (timestamp)

### Clients Table
Required columns for email sending:
- `id` (uuid, primary key)
- `name` (string)
- `email` (string)

### Projects Table
Required columns for project maintenance:
- `id` (uuid, primary key)
- `project_name` (string)
- `completion_date` (timestamp)
- `status` (string)
- `is_archived` (boolean)
- `updated_at` (timestamp)

### Expenses Table
Required columns for monthly reports:
- `id` (uuid, primary key)
- `amount` (numeric)
- `expense_date` (timestamp)

## Email Templates

The system includes pre-built email templates:

1. **invoice-reminder** - Due/overdue invoices
2. **monthly-report** - Monthly financial summary
3. **payment-received** - Payment confirmation (can be used manually)
4. **project-deadline** - Project deadline reminders

To customize email templates, edit:
```
lib/email-service.ts → renderEmailTemplate() function
```

## Monitoring

### Log Locations

- **Local Development:** Check terminal output
- **Vercel:** View in Vercel dashboard → Functions
- **Self-hosted:** Check application logs

### Metrics to Track

- Task execution time
- Success/failure rates
- Email delivery status
- Data processing counts (invoices updated, reports sent, projects archived)

## Security Considerations

1. **Secret Key Management**
   - Never commit `SCHEDULER_SECRET_KEY` to version control
   - Use different keys for dev/staging/production
   - Rotate keys quarterly

2. **HTTPS Only**
   - All automation endpoints must use HTTPS
   - External schedulers should only connect via HTTPS

3. **Request Validation**
   - Always verify Authorization header
   - Validate request method (POST or GET)
   - Log failed authentication attempts

4. **Rate Limiting**
   - Consider implementing IP-based rate limiting
   - Use API keys instead of Bearer tokens for additional security

## Troubleshooting

### Task Returns 500 Error
1. Check server logs for detailed error
2. Verify database connection
3. Ensure all required tables/columns exist
4. Verify email provider configuration

### Emails Not Sent
1. Check `RESEND_API_KEY` or email provider setup
2. Verify recipient email addresses exist in database
3. Check email provider's delivery logs
4. Verify `NEXT_PUBLIC_APP_URL` is set correctly

### Task Not Running at Scheduled Time
1. Verify scheduler service is active
2. Check scheduler logs for failed requests
3. Manually trigger task to verify endpoint works
4. Ensure `SCHEDULER_SECRET_KEY` matches

## Advanced Usage

### Custom Automation Tasks

To add custom automation tasks:

1. Create automation function in `lib/automation.ts`
2. Create API route in `app/api/automation/[task-name]/route.ts`
3. Add verification logic with `verifySchedulerSecret()`
4. Trigger via scheduler or manually

Example:
```typescript
// lib/automation.ts
export async function myCustomTask() {
  // Your automation logic here
  return { success: true }
}

// app/api/automation/my-task/route.ts
import { myCustomTask } from '@/lib/automation'

export async function POST(request: NextRequest) {
  if (!verifySchedulerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await myCustomTask()
  return NextResponse.json({ success: true, result })
}
```

Then add to your scheduler and automation page UI.
