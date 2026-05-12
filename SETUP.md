# Archon Ledger - Setup & Deployment

## Quick Setup (15 minutes to live)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Copy your Project URL and Anon Key
4. Go to Settings > Auth > Toggle "Confirm email" OFF (for development)

### 3. Setup Environment
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### 4. Run Locally
```bash
npm run dev
```

Visit: http://localhost:3000
- Sign up at /auth/signup
- Login at /auth/login
- Access dashboard

### 5. Deploy to Vercel
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

Then import to Vercel and add environment variables.

## Features
✅ Professional Dashboard
✅ Project Management
✅ Invoice Tracking
✅ Expense Logging
✅ Client Management
✅ Supabase Integration
✅ Type-safe with TypeScript
✅ Responsive Design

## Next Steps
1. Create Supabase tables using DATABASE_SCHEMA.sql
2. Implement dashboard pages with data fetching
3. Add form components for CRUD operations
4. Deploy to production

## Support
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- Tailwind: https://tailwindcss.com/docs
