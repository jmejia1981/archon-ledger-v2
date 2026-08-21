'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SkeletonKPICards } from '@/app/components/skeleton-loader'
import { mileageEntryCost } from '@/lib/calculations'
import { Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface FinancialMetrics {
  totalRevenue: number; totalCollected: number; totalExpenses: number
  directCosts: number; laborCosts: number; overhead: number
  grossProfit: number; netProfit: number; profitMargin: number
}

interface PLLine { label: string; amount: number; indent?: boolean; bold?: boolean; separator?: boolean }
interface BSLine  { label: string; amount: number; indent?: boolean; bold?: boolean; separator?: boolean }
interface ReviewFlag { severity: 'critical' | 'high' | 'medium'; title: string; detail: string; amount?: number }

const supabase = createClient()

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalRevenue: 0, totalCollected: 0, totalExpenses: 0,
    directCosts: 0, laborCosts: 0, overhead: 0,
    grossProfit: 0, netProfit: 0, profitMargin: 0,
  })
  const [plLines, setPlLines]   = useState<PLLine[]>([])
  const [bsLines, setBsLines]   = useState<BSLine[]>([])
  const [taxBreakdown, setTaxBreakdown] = useState<{ category: string; amount: number }[]>([])
  const [taxEstimate, setTaxEstimate] = useState({ netProfit: 0, accountsPayable: 0, taxableIncome: 0, taxOwed: 0 })
  const [reviewFlags, setReviewFlags] = useState<ReviewFlag[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectDistribution, setProjectDistribution] = useState<any[]>([])
  const [laborByDept, setLaborByDept] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [yearEndYear, setYearEndYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  useEffect(() => {
    const loadReportsData = async () => {
      try {
        const [expensesRes, invoicesRes, laborRes, projectsRes, employeesRes, mileageRes, payrollRes, paymentsRes, vendorsRes] = await Promise.all([
          supabase.from('expenses').select('*'),
          supabase.from('invoices').select('*'),
          supabase.from('labor_entries').select('*'),
          supabase.from('projects').select('*'),
          // name is null for every row in practice; first/last are the populated fields
          supabase.from('employees').select('id, name, first_name, last_name, hourly_rate, department'),
          supabase.from('mileage_entries').select('*'),
          supabase.from('payroll').select('*'),
          supabase.from('payments').select('id, invoice_id, amount, payment_date, notes'),
          supabase.from('vendors').select('id, name, is_1099_required, w9_on_file'),
        ])

        let expenses = expensesRes.data || []
        let invoices = invoicesRes.data || []
        let laborEntries = laborRes.data || []
        let mileageEntries = mileageRes.data || []
        const projects = projectsRes.data || []
        const employees = employeesRes.data || []

        const startDate = new Date(dateRange.startDate)
        const endDate   = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59, 999)

        const vendorBillsRes = await supabase.from('vendor_bills').select('id, amount, amount_paid, category, tax_category, issue_date, due_date')
        if (vendorBillsRes.error) console.error('vendor_bills fetch error:', vendorBillsRes.error)
        const vendorBillsData = (vendorBillsRes.data || []).filter((b: any) => {
          const d = new Date((b.issue_date || b.due_date) + 'T00:00:00')
          return d >= startDate && d <= endDate
        })

        invoices = invoices.filter((inv: any) => {
          const d = new Date(inv.invoice_date || inv.created_at)
          return d >= startDate && d <= endDate
        })
        expenses = expenses.filter((exp: any) => {
          const d = new Date(exp.date || exp.created_at)
          return d >= startDate && d <= endDate
        })
        // Filter labor entries by date range
        laborEntries = laborEntries.filter((entry: any) => {
          if (!entry.date) return true
          const d = new Date(entry.date + 'T00:00:00')
          return d >= startDate && d <= endDate
        })
        // Filter mileage entries by date range
        mileageEntries = mileageEntries.filter((entry: any) => {
          if (!entry.date) return true
          const d = new Date(entry.date + 'T00:00:00')
          return d >= startDate && d <= endDate
        })

        // ── Revenue ──────────────────────────────────────────────────────────
        const totalRevenue  = invoices.reduce((s: number, inv: any) => s + (inv.invoice_amount || inv.amount || 0), 0)
        const totalCollected = invoices.reduce((s: number, inv: any) => s + (inv.amount_paid || 0), 0)
        const accountsReceivable = totalRevenue - totalCollected

        // ── Direct costs (COGS) ───────────────────────────────────────────────
        const directExpenses = expenses.filter((e: any) => e.category_group === 'direct-project-costs')
        const directByCategory: Record<string, number> = {}
        directExpenses.forEach((e: any) => {
          const cat = e.category || 'Other'
          directByCategory[cat] = (directByCategory[cat] || 0) + (e.amount || 0)
        })
        const directCosts = directExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)

        // ── Labor ─────────────────────────────────────────────────────────────
        // The P&L must use money actually paid, not timesheet hours priced at a
        // stored rate. Timesheets are a job-costing estimate; payroll is the
        // expense. Keeping the estimate as the P&L figure overstated labor by
        // ~$24.7k against recorded payroll during the 2026 audit.
        const payrollInRange = (payrollRes.data || []).filter((p: any) => {
          const raw = p.payroll_period_end || p.payroll_period_start
          if (!raw) return false
          const d = new Date(raw + (String(raw).includes('T') ? '' : 'T00:00:00'))
          return d >= startDate && d <= endDate
        })
        const payrollGross    = payrollInRange.reduce((s: number, p: any) => s + (p.gross_pay || 0), 0)
        const payrollTaxes    = payrollInRange.reduce((s: number, p: any) => s + (p.taxes || 0), 0)
        const payrollBenefits = payrollInRange.reduce((s: number, p: any) => s + (p.benefits || 0), 0)
        const laborCosts      = payrollGross + payrollTaxes + payrollBenefits

        // Timesheet valuation, kept only to surface the variance against payroll.
        const laborImputed = laborEntries.reduce((s: number, entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const rate = emp?.hourly_rate || 0
          return s + (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
        }, 0)
        const laborVariance = laborImputed - laborCosts

        // ── Mileage ───────────────────────────────────────────────────────────
        const mileageCosts = mileageEntries.reduce((s: number, entry: any) => {
          return s + mileageEntryCost(entry)
        }, 0)

        // ── Overhead ──────────────────────────────────────────────────────────
        const overheadExpenses = expenses.filter((e: any) => e.category_group === 'company-overhead')
        const overheadByCategory: Record<string, number> = {}
        overheadExpenses.forEach((e: any) => {
          const cat = e.category || 'Other'
          overheadByCategory[cat] = (overheadByCategory[cat] || 0) + (e.amount || 0)
        })
        const overhead = overheadExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)

        // ── Vendor bills paid (subcontractors / materials) ────────────────────
        const vendorBillsByCategory: Record<string, number> = {}
        vendorBillsData.forEach((b: any) => {
          const cat = b.category || 'Vendor Bills'
          vendorBillsByCategory[cat] = (vendorBillsByCategory[cat] || 0) + (b.amount_paid || 0)
        })
        const vendorBillsCost = vendorBillsData.reduce((s: number, b: any) => s + (b.amount_paid || 0), 0)

        const totalExpenses = directCosts + laborCosts + mileageCosts + overhead + vendorBillsCost
        const grossProfit   = totalRevenue - directCosts - laborCosts - mileageCosts - vendorBillsCost
        const netProfit     = grossProfit - overhead
        const profitMargin  = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        // ── Tax category breakdown (Schedule C) ──────────────────────────────
        const taxMap: Record<string, number> = {}
        // Expenses with explicit tax_category tags. Meals tagged 50% deductible are
        // halved here — the breakdown reports the deductible amount, which is why it
        // will not foot to book expenses. The disallowed half is shown as its own line.
        let mealsDisallowed = 0
        expenses.forEach((e: any) => {
          if (!e.tax_category) return
          const amount = e.amount || 0
          if (/50%\s*deductible/i.test(e.tax_category)) {
            mealsDisallowed += amount * 0.5
            taxMap[e.tax_category] = (taxMap[e.tax_category] || 0) + amount * 0.5
          } else {
            taxMap[e.tax_category] = (taxMap[e.tax_category] || 0) + amount
          }
        })
        // The crew is engaged as 1099 contractors, so their pay is contract labor
        // (Line 11), not wages (Line 26). Employer taxes and benefits are mapped
        // anyway for the case where W-2 staff are added later; for contractors they
        // stay at zero, since the business owes no employer FICA on 1099 pay.
        if (payrollGross > 0) {
          taxMap['Contract Labor (Line 11)'] = (taxMap['Contract Labor (Line 11)'] || 0) + payrollGross
        }
        if (payrollTaxes > 0) {
          taxMap['Taxes & Licenses (Line 23)'] = (taxMap['Taxes & Licenses (Line 23)'] || 0) + payrollTaxes
        }
        if (payrollBenefits > 0) {
          taxMap['Employee Benefit Programs (Line 14)'] = (taxMap['Employee Benefit Programs (Line 14)'] || 0) + payrollBenefits
        }
        // Mileage → Schedule C Line 9: Car and truck expenses
        if (mileageCosts > 0) {
          taxMap['Car & Truck Expenses (Line 9)'] = (taxMap['Car & Truck Expenses (Line 9)'] || 0) + mileageCosts
        }
        // Standard mileage and actual vehicle costs generally cannot both be claimed
        // for the same vehicle. Detect the overlap rather than silently summing them.
        const actualVehicleCosts = expenses
          .filter((e: any) => /car\s*&?\s*truck/i.test(e.tax_category || ''))
          .reduce((s: number, e: any) => s + (e.amount || 0), 0)
        const vehicleMethodConflict = actualVehicleCosts > 0 && mileageCosts > 0
        // Vendor bills → by tax_category if tagged, else by category
        vendorBillsData.forEach((b: any) => {
          const paid = b.amount_paid || 0
          if (paid <= 0) return
          const key = b.tax_category || b.category || 'Subcontractors & Materials'
          taxMap[key] = (taxMap[key] || 0) + paid
        })
        setTaxBreakdown(
          Object.entries(taxMap)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
        )

        // ── P&L lines ─────────────────────────────────────────────────────────
        const totalCOGS = directCosts + laborCosts + mileageCosts + vendorBillsCost
        const pl: PLLine[] = [
          { label: 'REVENUE', amount: totalRevenue, bold: true },
          { label: 'Total Invoiced', amount: totalRevenue, indent: true },
          { label: 'Total Collected', amount: totalCollected, indent: true },
          { label: '', amount: 0, separator: true },
          { label: 'COST OF GOODS SOLD', amount: totalCOGS, bold: true },
          ...Object.entries(directByCategory).map(([label, amount]) => ({ label, amount, indent: true })),
          ...(payrollGross > 0 ? [{ label: 'Contract Labor (1099 crew)', amount: payrollGross, indent: true }] : []),
          ...(payrollTaxes > 0 ? [{ label: 'Payroll — Employer Taxes', amount: payrollTaxes, indent: true }] : []),
          ...(payrollBenefits > 0 ? [{ label: 'Payroll — Benefits', amount: payrollBenefits, indent: true }] : []),
          ...(mileageCosts > 0 ? [{ label: 'Mileage', amount: mileageCosts, indent: true }] : []),
          ...Object.entries(vendorBillsByCategory).map(([label, amount]) => ({ label, amount, indent: true })),
          { label: 'Total COGS', amount: totalCOGS, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'GROSS PROFIT', amount: grossProfit, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'OPERATING EXPENSES', amount: overhead, bold: true },
          ...Object.entries(overheadByCategory).map(([label, amount]) => ({ label, amount, indent: true })),
          { label: 'Total Operating Expenses', amount: overhead, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'NET INCOME', amount: netProfit, bold: true },
        ]
        setPlLines(pl)

        // ── Balance sheet lines ───────────────────────────────────────────────
        const accountsPayable = vendorBillsData
          .filter((b: any) => (b.amount_paid || 0) < (b.amount || 0))
          .reduce((s: number, b: any) => s + ((b.amount || 0) - (b.amount_paid || 0)), 0)

        // This is a working-capital position, not a balance sheet. A balance sheet
        // needs cash, fixed assets, debt and owner equity; none of those exist in
        // this system. The previous version reported `collected + AR` as total
        // assets, which made assets identically equal revenue and equity equal to
        // assets — it never tied to net income. Report only what is supported and
        // name the gaps rather than inventing figures.
        const workingCapital = accountsReceivable - accountsPayable

        const bs: BSLine[] = [
          { label: 'RECORDED ASSETS', amount: accountsReceivable, bold: true },
          { label: 'Accounts Receivable', amount: accountsReceivable, indent: true },
          { label: 'Total Recorded Assets', amount: accountsReceivable, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'RECORDED LIABILITIES', amount: accountsPayable, bold: true },
          { label: 'Accounts Payable', amount: accountsPayable, indent: true },
          { label: 'Total Recorded Liabilities', amount: accountsPayable, bold: true },
          { label: '', amount: 0, separator: true },
          { label: 'NET WORKING CAPITAL', amount: workingCapital, bold: true },
        ]
        setBsLines(bs)

        // ── Tax estimate ──────────────────────────────────────────────────────
        // Accounts payable is NOT subtracted here. Vendor bills are expensed at
        // amount_paid, so unpaid bills were never deducted in the first place;
        // subtracting them again would double-deduct.
        const taxableIncome = netProfit
        const taxOwed = Math.max(0, taxableIncome * 0.30)
        setTaxEstimate({ netProfit, accountsPayable, taxableIncome, taxOwed })

        // ── CPA review flags ──────────────────────────────────────────────────
        // Surface reconciliation breaks instead of letting them sit silently inside
        // otherwise clean-looking totals.
        const flags: ReviewFlag[] = []

        // Severity scales with how big the gap is, not merely that one exists. A
        // flat threshold reported a 0.8% difference as CRITICAL alongside genuinely
        // material problems, which trains the reader to ignore the panel. A small
        // residue is expected and benign: timesheets are revalued at each
        // employee's current hourly rate, while payroll holds the gross actually
        // paid at the time, so any later rate change shows up here forever.
        const laborVariancePct = laborCosts > 0 ? Math.abs(laborVariance) / laborCosts * 100 : 0
        if (Math.abs(laborVariance) >= 100 && laborVariancePct >= 0.5) {
          const material = Math.abs(laborVariance) >= 5000 || laborVariancePct >= 10
          flags.push({
            severity: material ? 'critical' : laborVariancePct >= 2 ? 'high' : 'medium',
            title: 'Timesheet labor does not match payroll',
            detail: material
              ? `Timesheets value labor at ${fmt(laborImputed)}; payroll records ${fmt(laborCosts)} — a ${laborVariancePct.toFixed(1)}% gap. The P&L uses payroll. A difference this size usually means payroll was never run for some weeks.`
              : `Timesheets value labor at ${fmt(laborImputed)}; payroll records ${fmt(laborCosts)}, a ${laborVariancePct.toFixed(1)}% difference. Small gaps like this normally mean an hourly rate was edited after payroll ran, which restates the timesheet valuation but not the pay. Worth confirming rather than correcting.`,
            amount: laborVariance,
          })
        }

        // The crew is paid as 1099 contractors, so employer FICA is correctly zero.
        // What that creates instead is a filing obligation for anyone over $600.
        const contractorTotals = new Map<string, number>()
        payrollInRange.forEach((p: any) => {
          const emp = employees.find((e: any) => e.id === p.employee_id)
          const name = emp?.name || [emp?.first_name, emp?.last_name].filter(Boolean).join(' ') || 'Unknown'
          contractorTotals.set(name, (contractorTotals.get(name) || 0) + (p.gross_pay || 0))
        })
        const over600 = [...contractorTotals.entries()].filter(([, v]) => v >= 600)
        if (over600.length > 0) {
          flags.push({
            severity: 'high',
            title: `${over600.length} contractor${over600.length > 1 ? 's' : ''} require a 1099-NEC`,
            detail: `Paid $600 or more this year: ${over600.map(([n, v]) => `${n} ${fmt(v)}`).join(', ')}. Each needs a W-9 on file and a 1099-NEC filed.`,
            amount: over600.reduce((s, [, v]) => s + v, 0),
          })
        }
        if (payrollGross > 0) {
          flags.push({
            severity: 'high',
            title: 'Worker classification needs confirmation',
            detail: `${fmt(payrollGross)} is paid as 1099 contract labor, but the crew is tracked on hourly rates and weekly timesheets, several at 40+ hours. That pattern draws IRS and state scrutiny. Have your CPA confirm the classification — this system cannot determine it.`,
          })
        }

        const paymentsInRange = (paymentsRes.data || []).filter((p: any) => {
          if (!p.payment_date) return false
          const d = new Date(p.payment_date + (String(p.payment_date).includes('T') ? '' : 'T00:00:00'))
          return d >= startDate && d <= endDate
        })
        const paymentsTotal = paymentsInRange.reduce((s: number, p: any) => s + (p.amount || 0), 0)
        const paymentsGap = totalCollected - paymentsTotal
        if (Math.abs(paymentsGap) > 1) {
          flags.push({
            severity: 'critical',
            title: 'Invoice collections do not tie to payment records',
            detail: `Invoices report ${fmt(totalCollected)} collected but the payments ledger holds ${fmt(paymentsTotal)}. Revenue cannot be traced to cash received until this is resolved.`,
            amount: paymentsGap,
          })
        }

        if (vehicleMethodConflict) {
          flags.push({
            severity: 'high',
            title: 'Both mileage and actual vehicle costs claimed',
            detail: `${fmt(actualVehicleCosts)} of actual vehicle expenses plus ${fmt(mileageCosts)} of standard mileage. These generally cannot both be claimed for the same vehicle — your CPA must pick one method.`,
            amount: actualVehicleCosts + mileageCosts,
          })
        }

        // Duplicate detection: same vendor + amount + date.
        const seen = new Map<string, number>()
        expenses.forEach((e: any) => {
          const k = `${(e.vendor || '').trim().toLowerCase()}|${e.amount}|${e.date}`
          seen.set(k, (seen.get(k) || 0) + 1)
        })
        const dupExpenses = [...seen.values()].filter((n) => n > 1).length
        if (dupExpenses > 0) {
          flags.push({
            severity: 'high',
            title: `${dupExpenses} possible duplicate expense${dupExpenses > 1 ? 's' : ''}`,
            detail: 'Same vendor, amount, and date recorded more than once. Confirm each is a genuine separate purchase.',
          })
        }

        // Gaps in invoice numbering can mean deleted or unrecorded revenue.
        const invoiceNums = invoices
          .map((inv: any) => parseInt(String(inv.invoice_number || '').replace(/\D/g, ''), 10))
          .filter((n: number) => !isNaN(n))
          .sort((a: number, b: number) => a - b)
        if (invoiceNums.length > 1) {
          const missing: number[] = []
          for (let n = invoiceNums[0]; n < invoiceNums[invoiceNums.length - 1]; n++) {
            if (!invoiceNums.includes(n)) missing.push(n)
          }
          if (missing.length > 0) {
            flags.push({
              severity: 'high',
              title: `${missing.length} gap${missing.length > 1 ? 's' : ''} in invoice numbering`,
              detail: `Missing invoice number${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Confirm these were voided rather than unrecorded revenue.`,
            })
          }
        }

        const missingReceipts = expenses.filter((e: any) => !e.receipt_url && (e.amount || 0) >= 75).length
        if (missingReceipts > 0) {
          flags.push({
            severity: 'medium',
            title: `${missingReceipts} expense${missingReceipts > 1 ? 's' : ''} over $75 without a receipt`,
            detail: 'IRS substantiation generally requires a receipt at $75 and above.',
          })
        }

        if (mealsDisallowed > 0) {
          flags.push({
            severity: 'medium',
            title: 'Meals reported at 50%',
            detail: `${fmt(mealsDisallowed)} of meal cost is excluded from the deduction. Employee-event meals may qualify at 100% — confirm the tagging with your CPA.`,
            amount: mealsDisallowed,
          })
        }

        // Vendors are a separate 1099 population from the payroll crew, and were
        // not represented here at all.
        const vendors1099 = (vendorsRes.data || []).filter((v: any) => v.is_1099_required)
        const vendorsNoW9 = vendors1099.filter((v: any) => !v.w9_on_file)
        if (vendorsNoW9.length > 0) {
          flags.push({
            severity: 'high',
            title: `${vendorsNoW9.length} vendor${vendorsNoW9.length > 1 ? 's' : ''} flagged for 1099 without a W-9`,
            detail: `${vendorsNoW9.map((v: any) => v.name).join(', ')}. A W-9 is needed before a 1099-NEC can be filed, and is far harder to obtain after the working relationship ends.`,
          })
        }

        // Payment dates that were assumed rather than observed. They drive
        // cash-basis timing, so the accountant should know which are which.
        const backfilled = (paymentsRes.data || []).filter((p: any) => String(p.notes || '').startsWith('Backfilled'))
        if (backfilled.length > 0) {
          flags.push({
            severity: 'medium',
            title: `${backfilled.length} payment${backfilled.length > 1 ? 's' : ''} carry an assumed date`,
            detail: 'These invoices were marked paid without a payment record, so the invoice date was used as the payment date. The amounts are correct; the dates are approximations and run slightly early.',
            amount: backfilled.reduce((s: number, p: any) => s + (p.amount || 0), 0),
          })
        }

        // Every bill entered as already settled means accounts payable is
        // structurally zero — a cash-basis pattern the accountant must be told
        // about, since it makes the payables balance meaningless rather than good.
        const allBills = vendorBillsRes.data || []
        const settledOnEntry = allBills.filter((b: any) => (b.amount_paid || 0) >= (b.amount || 0))
        if (allBills.length > 0 && settledOnEntry.length === allBills.length) {
          flags.push({
            severity: 'medium',
            title: 'Every vendor bill is recorded as fully paid',
            detail: `All ${allBills.length} bills carry no outstanding balance, so accounts payable is always zero. That usually means bills are entered only once settled, which is a cash-basis treatment. Confirm it matches the accounting method on the return.`,
          })
        }

        setReviewFlags(flags)

        // ── Monthly chart data ────────────────────────────────────────────────
        const monthlyObj: Record<string, any> = {}
        invoices.forEach((inv: any) => {
          const key = new Date((inv.invoice_date || inv.created_at) + ((inv.invoice_date || inv.created_at).includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].revenue += inv.invoice_amount || inv.amount || 0
        })
        expenses.forEach((exp: any) => {
          const key = new Date((exp.date || exp.created_at) + ((exp.date || exp.created_at).includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].expenses += exp.amount || 0
        })
        // Add labor costs to monthly chart
        laborEntries.forEach((entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const rate = emp?.hourly_rate || 0
          const cost = (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
          if (cost <= 0) return
          const rawDate = entry.date || entry.created_at
          const key = new Date(rawDate + (rawDate && !rawDate.includes('T') ? 'T00:00:00' : '')).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].expenses += cost
        })
        // Add mileage costs to monthly chart
        mileageEntries.forEach((entry: any) => {
          const cost = mileageEntryCost(entry)
          if (cost <= 0) return
          const rawDate = entry.date || entry.created_at
          const key = new Date(rawDate + (rawDate && !rawDate.includes('T') ? 'T00:00:00' : '')).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
          if (!monthlyObj[key]) monthlyObj[key] = { month: key, revenue: 0, expenses: 0 }
          monthlyObj[key].expenses += cost
        })
        setMonthlyData(Object.values(monthlyObj).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()))

        const projDist = projects.map((p: any) => ({
          name: p.project_name,
          value: invoices.filter((inv: any) => inv.project_id === p.id).reduce((s: number, inv: any) => s + (inv.invoice_amount || inv.amount || 0), 0),
        })).filter((p: any) => p.value > 0)
        setProjectDistribution(projDist)

        const deptLabor: Record<string, any> = {}
        laborEntries.forEach((entry: any) => {
          const emp = employees.find((e: any) => e.id === entry.employee_id)
          const dept = emp?.department || 'General', rate = emp?.hourly_rate || 0
          const cost = (entry.regular_hours || 0) * rate + (entry.overtime_hours || 0) * rate * 1.5
          if (!deptLabor[dept]) deptLabor[dept] = { name: dept, value: 0 }
          deptLabor[dept].value += cost
        })
        setLaborByDept(Object.values(deptLabor))

        setMetrics({ totalRevenue, totalCollected, totalExpenses, directCosts, laborCosts: laborCosts + mileageCosts, overhead, grossProfit, netProfit, profitMargin })
      } catch (error) { console.error('Error:', error) }
      finally { setLoading(false) }
    }
    loadReportsData()
  }, [dateRange])

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  const COLORS = ['#1A3A6B', '#C8B89A', '#8B9A7D', '#D4A574']

  const exportYearEndPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(26, 58, 107)
    doc.text('Archon Construction LLC', pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.setFontSize(12)
    doc.text(`Year-End Financial Package — ${yearEndYear}`, pageWidth / 2, y, { align: 'center' })
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth / 2, y, { align: 'center' })
    y += 10

    // P&L
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(26, 58, 107)
    doc.text('Profit & Loss Statement', margin, y)
    y += 2
    doc.setDrawColor(200, 184, 154)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: plLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [
          { content: l.label, styles: { fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: l.indent ? 8 : 3, top: 2, bottom: 2, right: 3 } } },
          { content: l.amount !== 0 || l.bold ? fmt(l.amount) : '', styles: { halign: 'right', fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: 3, top: 2, bottom: 2, right: 3 } } },
        ]),
      bodyStyles: { fontSize: 9, textColor: [33, 47, 61] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50 } },
      theme: 'plain',
    })
    y = (doc as any).lastAutoTable.finalY + 12

    if (y > 240) { doc.addPage(); y = 20 }

    // Balance Sheet
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(26, 58, 107)
    doc.text('Balance Sheet', margin, y)
    y += 2
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: bsLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [
          { content: l.label, styles: { fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: l.indent ? 8 : 3, top: 2, bottom: 2, right: 3 } } },
          { content: l.amount !== 0 || l.bold ? fmt(l.amount) : '', styles: { halign: 'right', fontStyle: l.bold ? 'bold' : 'normal', cellPadding: { left: 3, top: 2, bottom: 2, right: 3 } } },
        ]),
      bodyStyles: { fontSize: 9, textColor: [33, 47, 61] },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50 } },
      theme: 'plain',
    })
    y = (doc as any).lastAutoTable.finalY + 12

    if (y > 220) { doc.addPage(); y = 20 }

    // Schedule C
    if (taxBreakdown.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(26, 58, 107)
      doc.text('Schedule C Expense Summary', margin, y)
      y += 2
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      const total = taxBreakdown.reduce((s, r) => s + r.amount, 0)
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Category', 'Amount', '% of Total']],
        body: [
          ...taxBreakdown.map((r) => [r.category, fmt(r.amount), `${total > 0 ? ((r.amount / total) * 100).toFixed(1) : 0}%`]),
          ['Total', fmt(total), '100%'],
        ],
        headStyles: { fillColor: [200, 184, 154], textColor: [33, 47, 61], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        theme: 'grid',
      })
    }

    // Footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Archon Construction LLC  ·  ${yearEndYear} Year-End Package  ·  Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' })
    }

    doc.save(`archon-year-end-${yearEndYear}.pdf`)
  }

  const exportScheduleC_CSV = () => {
    const rows = [
      ['IRS Schedule C Category', 'Amount', '% of Total Expenses'],
      ...taxBreakdown.map((r) => {
        const total = taxBreakdown.reduce((s, t) => s + t.amount, 0)
        return [r.category, r.amount.toFixed(2), `${total > 0 ? ((r.amount / total) * 100).toFixed(1) : 0}%`]
      }),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-c-${yearEndYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPL_CSV = () => {
    const rows = [
      ['Line Item', 'Amount'],
      ...plLines
        .filter((l) => !l.separator && l.label)
        .map((l) => [l.label, l.amount !== 0 || l.bold ? l.amount.toFixed(2) : '']),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profit-loss-${yearEndYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const StatementLine = ({ line }: { line: PLLine | BSLine }) => {
    if (line.separator) return <tr><td colSpan={2} className="py-1"><hr style={{ borderColor: '#e5e7eb' }} /></td></tr>
    if (!line.label) return null
    return (
      <tr className={line.bold ? 'bg-gray-50' : 'hover:bg-gray-50'}>
        <td className={`py-2 text-sm ${line.indent ? 'pl-8' : 'pl-4'} ${line.bold ? 'font-semibold' : ''}`} style={{ color: line.bold ? '#1A3A6B' : '#374151' }}>
          {line.label}
        </td>
        <td className={`py-2 pr-4 text-sm text-right ${line.bold ? 'font-semibold' : ''}`} style={{ color: line.amount < 0 ? '#dc2626' : '#1A3A6B' }}>
          {line.amount !== 0 || line.bold ? fmt(line.amount) : ''}
        </td>
      </tr>
    )
  }

  if (loading) return (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
      <SkeletonKPICards />
    </div>
  )

  const tabs = ['Overview', 'P&L', 'Balance Sheet', 'Tax Summary', 'Year-End']

  return (
    <div className="space-y-6" style={{ backgroundColor: '#F5F5F5', padding: '32px' }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#1A3A6B' }}>Reports</h1>
          <p className="text-sm text-gray-500">Financial statements and analytics</p>
        </div>
        <div className="flex gap-2 items-center">
          <input id="report-start" name="startDate" type="date" value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }} />
          <span className="text-sm text-gray-500">to</span>
          <input id="report-end" name="endDate" type="date" value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }} />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(metrics.totalRevenue) },
          { label: 'Gross Profit', value: fmt(metrics.grossProfit), color: metrics.grossProfit >= 0 ? '#059669' : '#dc2626' },
          { label: 'Net Income', value: fmt(metrics.netProfit), color: metrics.netProfit >= 0 ? '#059669' : '#dc2626' },
          { label: 'Profit Margin', value: `${metrics.profitMargin.toFixed(1)}%`, color: metrics.profitMargin >= 0 ? '#059669' : '#dc2626' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg p-5 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color || '#1A3A6B' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: '#E0E0E0' }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
            className="px-2 py-3 text-sm font-medium whitespace-nowrap"
            style={{ color: activeTab === tab.toLowerCase() ? '#1A3A6B' : '#999', borderBottom: activeTab === tab.toLowerCase() ? '2px solid #1A3A6B' : 'none' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Revenue vs Expenses</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1A3A6B" stopOpacity={0.1} /><stop offset="95%" stopColor="#1A3A6B" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4A574" stopOpacity={0.1} /><stop offset="95%" stopColor="#D4A574" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => fmt(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#1A3A6B" strokeWidth={2} fill="url(#colorRev)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#D4A574" strokeWidth={2} fill="url(#colorExp)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No data for selected period</p></div>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Revenue by Project</h3>
              {projectDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart><Pie data={projectDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {projectDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip formatter={(v: number) => fmt(v)} /></PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No project data</p></div>}
            </div>
            <div className="rounded-lg p-6 shadow-sm" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
              <h3 className="text-base font-semibold mb-4" style={{ color: '#1A3A6B' }}>Labor by Department</h3>
              {laborByDept.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={laborByDept} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} /><Tooltip formatter={(v: number) => fmt(v)} /><Bar dataKey="value" fill="#1A3A6B" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center bg-gray-50 rounded"><p className="text-gray-400">No labor data</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* ── P&L ── */}
      {activeTab === 'p&l' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Profit & Loss Statement</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} —{' '}
              {new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <table className="w-full">
            <tbody>
              {plLines.map((line, i) => <StatementLine key={i} line={line} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Balance Sheet ── */}
      {activeTab === 'balance sheet' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Working Capital Position</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              As of {new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="px-6 py-3" style={{ backgroundColor: '#fef3c7', borderBottom: '1px solid #E0E0E0' }}>
            <p className="text-xs" style={{ color: '#92400e' }}>
              <strong>This is not a balance sheet.</strong> It shows only receivables and payables — the two balances this system tracks.
              Cash and bank accounts, credit cards, loans, fixed assets, and owner equity are not recorded anywhere, so a real
              balance sheet cannot be produced from this data. Your accountant will need bank and credit card statements.
            </p>
          </div>
          <table className="w-full">
            <tbody>
              {bsLines.map((line, i) => <StatementLine key={i} line={line} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Year-End Package ── */}
      {activeTab === 'year-end' && (
        <div className="space-y-6">
          {/* CPA review items — bookkeeping problems, kept separate from the statements */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3A6B' }}>
                Items Needing CPA Review {reviewFlags.length > 0 && `(${reviewFlags.length})`}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Resolve these before sending the package — they affect reported income</p>
            </div>
            {reviewFlags.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-400">No issues detected for this period.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                {reviewFlags.map((flag, i) => {
                  const tone = flag.severity === 'critical'
                    ? { bg: '#fee2e2', fg: '#991b1b', label: 'CRITICAL' }
                    : flag.severity === 'high'
                    ? { bg: '#fef3c7', fg: '#92400e', label: 'HIGH' }
                    : { bg: '#e0e7ff', fg: '#3730a3', label: 'MEDIUM' }
                  return (
                    <div key={i} className="px-6 py-4 flex gap-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold h-fit flex-shrink-0"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}>{tone.label}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium" style={{ color: '#1A3A6B' }}>{flag.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{flag.detail}</p>
                      </div>
                      {flag.amount !== undefined && (
                        <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#dc2626' }}>{fmt(flag.amount)}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Year-End Accountant Package</h2>
              <p className="text-xs text-gray-500 mt-0.5">Export everything your accountant needs in one click</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={yearEndYear} onChange={(e) => setYearEndYear(parseInt(e.target.value))}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'white', border: '1px solid #D4D0C8', color: '#1A3A6B' }}>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Full Year-End PDF', sub: 'P&L + Balance Sheet + Schedule C', action: exportYearEndPDF, color: '#1A3A6B' },
              { label: 'P&L Spreadsheet', sub: 'Profit & Loss as CSV', action: exportPL_CSV, color: '#059669' },
              { label: 'Schedule C CSV', sub: 'IRS expense categories', action: exportScheduleC_CSV, color: '#7c3aed' },
            ].map(({ label, sub, action, color }) => (
              <button key={label} onClick={action}
                className="flex items-center gap-4 p-5 rounded-xl text-left hover:opacity-90 transition-opacity"
                style={{ backgroundColor: color, color: 'white' }}>
                <Download className="w-8 h-8 flex-shrink-0 opacity-80" />
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{sub}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Tax Estimate */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3A6B' }}>Estimated Taxes Owed — {yearEndYear}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Rough placeholder only — a flat 30% of net profit. Ignores self-employment tax, entity type, QBI, and state tax. Not a tax calculation.
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {[
                { label: 'Net Profit (P&L)', value: taxEstimate.netProfit },
                { label: 'Taxable Income (before CPA adjustments)', value: taxEstimate.taxableIncome, bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className="flex items-center justify-between px-6 py-3">
                  <span className={`text-sm ${bold ? 'font-semibold' : ''}`} style={{ color: '#374151' }}>{label}</span>
                  <span className={`text-sm ${bold ? 'font-semibold' : ''}`} style={{ color: value < 0 ? '#dc2626' : '#1A3A6B' }}>{fmt(value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#1A3A6B' }}>
                <span className="text-sm font-bold text-white">Estimated Tax Owed (30%)</span>
                <span className="text-lg font-bold text-white">{fmt(taxEstimate.taxOwed)}</span>
              </div>
              {taxEstimate.taxableIncome <= 0 && (
                <div className="px-6 py-3">
                  <p className="text-xs text-gray-500">No tax owed — taxable income is zero or negative.</p>
                </div>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3A6B' }}>Year-End Checklist for Your Accountant</h3>
            </div>
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {[
                { label: 'Profit & Loss Statement', detail: 'Full year revenue and expenses', done: plLines.length > 0, action: 'In Reports → P&L tab' },
                { label: 'Balance Sheet', detail: 'Assets, liabilities, and equity as of Dec 31', done: bsLines.length > 0, action: 'In Reports → Balance Sheet tab' },
                { label: 'Schedule C Expense Summary', detail: 'All expenses sorted by IRS line item', done: taxBreakdown.length > 0, action: taxBreakdown.length === 0 ? 'Add tax categories to expenses first' : 'Export above' },
                { label: '1099-NEC Filing', detail: 'Vendors/subs paid $600+ (non-incorporated)', done: false, action: 'Go to 1099 page in sidebar' },
                { label: 'Fixed Asset & Depreciation Schedule', detail: 'Equipment purchases and Section 179 elections', done: false, action: 'Go to Fixed Assets page in sidebar' },
                { label: 'Mileage Log', detail: 'Business miles driven during the year', done: false, action: 'Export from Mileage page' },
                { label: 'Payroll Summary', detail: 'W-2s for employees, 1099-NECs for subs', done: false, action: 'From Payroll page' },
                { label: 'Bank Statements', detail: 'December 31 bank balance for reconciliation', done: false, action: 'From your bank — not tracked here' },
              ].map(({ label, detail, done, action }) => (
                <div key={label} className="flex items-start gap-4 px-6 py-4">
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: done ? '#d1fae5' : '#f3f4f6' }}>
                    {done && <span style={{ color: '#059669', fontSize: 10 }}>✓</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#1A3A6B' }}>{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                  </div>
                  <p className="text-xs text-right flex-shrink-0" style={{ color: done ? '#059669' : '#6b7280' }}>{action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Summary ── */}
      {activeTab === 'tax summary' && (
        <div className="rounded-lg shadow-sm overflow-hidden" style={{ backgroundColor: 'white', border: '1px solid #E0E0E0' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '#E0E0E0', backgroundColor: '#f9fafb' }}>
            <h2 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Tax Category Summary (Schedule C)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Expenses grouped by IRS Schedule C line item</p>
          </div>
          {taxBreakdown.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No expenses have been assigned a tax category yet. Add tax categories in the Expenses page.
            </div>
          ) : (
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#1A3A6B' }}>Schedule C Category</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#1A3A6B' }}>Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#1A3A6B' }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {taxBreakdown.map((row, i) => {
                  const total = taxBreakdown.reduce((s, r) => s + r.amount, 0)
                  return (
                    <tr key={i} className="border-t hover:bg-gray-50" style={{ borderColor: '#f3f4f6' }}>
                      <td className="px-6 py-3 text-sm" style={{ color: '#374151' }}>{row.category}</td>
                      <td className="px-6 py-3 text-sm text-right font-medium" style={{ color: '#1A3A6B' }}>{fmt(row.amount)}</td>
                      <td className="px-6 py-3 text-sm text-right text-gray-500">{total > 0 ? ((row.amount / total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  )
                })}
                <tr className="border-t bg-gray-50" style={{ borderColor: '#e5e7eb' }}>
                  <td className="px-6 py-3 text-sm font-semibold" style={{ color: '#1A3A6B' }}>Total Categorized Expenses</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold" style={{ color: '#1A3A6B' }}>{fmt(taxBreakdown.reduce((s, r) => s + r.amount, 0))}</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
