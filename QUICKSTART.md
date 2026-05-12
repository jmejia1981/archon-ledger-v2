# 🚀 Archon Ledger - Quick Start

Your professional construction financial management application is ready!

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd /Users/mejia/OneDrive/Documents/Claude/Projects/Archon/archon-ledger-v2
npm install
```

### Step 2: Create Supabase Project
1. Visit https://supabase.com
2. Click "New Project"
3. Fill in project name (e.g., "archon-ledger")
4. Create strong password
5. Select your region
6. Click "Create"
7. Wait 2-3 minutes...

### Step 3: Get Your Credentials
In Supabase Dashboard:
1. Go to Settings → API
2. Copy "Project URL" (https://xxxxx.supabase.co)
3. Copy "Anon Key" (public key)

### Step 4: Configure Environment
Create `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 5: Disable Email Confirmation (for development)
In Supabase:
1. Settings → Auth
2. Find "Confirm email" toggle
3. Turn it OFF
4. Save

### Step 6: Run Development Server
```bash
npm run dev
```

### Step 7: Test the App
1. Open http://localhost:3000
2. Click "Sign up"
3. Create test account
4. Login
5. See dashboard! ✅

## 📊 Features Ready to Use

✅ **Professional Dashboard** - KPI cards, metrics, navigation
✅ **Authentication** - Secure login/signup with Supabase
✅ **Navigation** - Links to Projects, Invoices, Expenses, Clients
✅ **Responsive Design** - Works on desktop, tablet, mobile
✅ **Professional Styling** - Premium Playfair Display + Inter fonts
✅ **TypeScript** - Full type safety
✅ **Database Ready** - SQL schema provided

## 🎨 Design Highlights

- **Color Scheme**: Professional dark blue (#1A3A6B) with light accents
- **Typography**: Playfair Display (headings) + Inter (body)
- **Components**: Professional UI with rounded corners and shadows
- **Layout**: Clean, spacious design with proper spacing
- **Accessibility**: WCAG compliant, semantic HTML

## 📚 What's Included

### Authentication Pages
- `/auth/login` - Professional login form
- `/auth/signup` - Sign up with validation

### Dashboard
- `/dashboard` - Main dashboard with metrics
- `/dashboard/projects` - Projects placeholder
- `/dashboard/invoices` - Invoices placeholder
- `/dashboard/expenses` - Expenses placeholder
- `/dashboard/clients` - Clients placeholder
- Plus: labor, mileage, payroll, receivables, reports

### Supabase Integration
- Client setup in `lib/supabase/client.ts`
- Type definitions ready
- Database schema provided

### Configuration
- TypeScript enabled
- Tailwind CSS configured
- Next.js 16 with App Router
- Modern React 19

## 🔧 Next Steps

### 1. Setup Database Tables
Copy-paste contents of `DATABASE_SCHEMA.sql` into Supabase SQL Editor

### 2. Create Data
- Add projects, clients, invoices
- Test the dashboard metrics

### 3. Implement Dashboard Pages
Each page in `/dashboard/*` is a placeholder waiting for your implementation

### 4. Add Forms
Use React Hook Form + Zod for validated forms

### 5. Deploy
- Push to GitHub
- Deploy on Vercel (recommended)
- Add environment variables in Vercel dashboard

## 📝 Project Structure

```
archon-ledger-v2/
├── app/                 # Next.js pages
│   ├── auth/           # Login/Signup
│   ├── dashboard/      # Feature pages
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── components/         # Reusable components (ready for expansion)
├── lib/               # Utilities
│   ├── supabase/
│   ├── types.ts
│   └── hooks.ts
├── styles/            # Global styles
├── public/            # Assets
├── package.json       # Dependencies
└── [config files]     # TypeScript, Tailwind, etc.
```

## 🌐 Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 | React framework |
| React 19 | UI library |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Supabase | Backend/Database |
| SWR | Data fetching |
| Recharts | Charts |
| Lucide Icons | Icons |
| React Hook Form | Form handling |
| Zod | Validation |

## 💡 Pro Tips

1. **Hot Reload**: Changes save instantly - no restart needed
2. **Database Queries**: Use SWR for data fetching with caching
3. **Forms**: Use React Hook Form + Zod for validation
4. **Components**: Create reusable components in `/components`
5. **Types**: Define database types in `lib/types.ts`

## 🐛 Troubleshooting

**"Cannot find Supabase"**
- Check `.env.local` has correct URL and key
- Restart dev server

**"User not authenticated"**
- Make sure you signed up and confirmed email
- Or disabled email confirmation in Supabase settings

**"Styles not loading"**
- Clear `.next` folder: `rm -rf .next`
- Restart dev server

**"Port 3000 in use"**
- Use different port: `npm run dev -- -p 3001`

## 📞 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Documentation](https://react.dev)

## ✨ You're All Set!

Your professional Archon Ledger application is ready to develop. Start with `npm run dev` and build amazing features! 🚀

---

**Questions?** Check README.md or SETUP.md for more details.
