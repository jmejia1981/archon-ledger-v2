-- Fix 1: Add missing line_items table for invoices
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_line_items_invoice_id ON line_items(invoice_id);

-- Fix 2: Add missing project_address column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_address TEXT,
ADD COLUMN IF NOT EXISTS project_street TEXT,
ADD COLUMN IF NOT EXISTS project_state TEXT,
ADD COLUMN IF NOT EXISTS project_zip TEXT;

-- Fix 3: Add missing payment_history table for payment tracking
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON payment_history(invoice_id);

-- ✅ All tables are now created and ready for use!
-- Line items will now save and display correctly in invoices
