-- Archon Ledger Database Schema
-- Run this in Supabase SQL Editor

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold')),
  budget DECIMAL(12, 2) DEFAULT 0,
  spent DECIMAL(12, 2) DEFAULT 0,
  start_date DATE,
  end_date DATE
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  project_id UUID REFERENCES projects(id),
  number TEXT UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  due_date DATE
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  project_id UUID REFERENCES projects(id),
  category TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT
);

-- Labor Entries
CREATE TABLE IF NOT EXISTS labor_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  project_id UUID REFERENCES projects(id),
  hours DECIMAL(5, 2) NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  date DATE
);

-- Mileage Entries
CREATE TABLE IF NOT EXISTS mileage_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  project_id UUID REFERENCES projects(id),
  miles DECIMAL(8, 2) NOT NULL,
  rate DECIMAL(10, 2) NOT NULL,
  date DATE
);

-- Indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_invoices_project_id ON invoices(project_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_labor_entries_project_id ON labor_entries(project_id);
CREATE INDEX idx_mileage_entries_project_id ON mileage_entries(project_id);
