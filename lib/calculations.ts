// Financial calculation functions for BuildLedger

export const calculations = {
  // Revised Contract Value = Contract Amount + Approved Change Orders
  revisedContractValue: (contractAmount: number, changeOrders: number) => {
    return contractAmount + changeOrders
  },

  // Total Project Cost = Expenses + Labor + Mileage
  totalProjectCost: (expenses: number, labor: number, mileage: number) => {
    return expenses + labor + mileage
  },

  // Net Profit = Revised Contract Value - Total Project Cost
  netProfit: (revisedValue: number, totalCost: number) => {
    return revisedValue - totalCost
  },

  // Profit Margin % = Net Profit / Revised Contract Value × 100
  profitMargin: (netProfit: number, revisedValue: number) => {
    return revisedValue > 0 ? (netProfit / revisedValue) * 100 : 0
  },

  // Outstanding Balance = Total Invoiced - Total Collected
  outstandingBalance: (invoiced: number, collected: number) => {
    return invoiced - collected
  },

  // Collection Rate % = Total Collected / Total Invoiced × 100
  collectionRate: (collected: number, invoiced: number) => {
    return invoiced > 0 ? (collected / invoiced) * 100 : 0
  },

  // Labor Cost = (Regular Hours × Hourly Rate) + (Overtime Hours × Overtime Rate)
  laborCost: (regularHours: number, hourlyRate: number, overtimeHours: number, overtimeRate: number) => {
    return regularHours * hourlyRate + overtimeHours * overtimeRate
  },

  // Mileage Cost = Miles Driven × Reimbursement Rate
  mileageCost: (miles: number, rate: number) => {
    return miles * rate
  },

  // True Labor Cost = Gross Pay + Employer Taxes + Benefits + Reimbursements
  trueLaborCost: (grossPay: number, taxes: number, benefits: number, reimbursements: number) => {
    return grossPay + taxes + benefits + reimbursements
  },
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`
}

export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

// ── Payroll allocation ──────────────────────────────────────────────────────
// The P&L takes labour cost from the payroll table, because that is what was
// actually paid. The dashboard needs the same figure, but also needs it split by
// project — and payroll rows carry no project_id. Timesheets do.
//
// So payroll stays the source of the money and timesheets are used only to
// apportion it: within one employee-week, each entry takes the share of that
// week's pay matching its share of the week's cost-weighted hours. Totals are
// therefore always the payroll figure, never a re-derived estimate, and the two
// pages cannot drift apart the way they did before.

// Pay weeks run Saturday–Friday, matching getWeekStart() in the labor and
// payroll pages.
export const payWeekStart = (dateStr: string): string => {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  const sat = new Date(d)
  sat.setDate(d.getDate() - ((d.getDay() + 1) % 7))
  return sat.toISOString().split('T')[0]
}

// Overtime is paid at 1.5x, so it must carry 1.5x the weight when apportioning.
const entryWeight = (e: any) => (e.regular_hours || 0) + (e.overtime_hours || 0) * 1.5

export interface PayrollAllocation {
  /** Allocated labour cost per labor_entries row id. */
  byEntryId: Map<string, number>
  /** Payroll with no timesheets in that employee-week — real cost, no project. */
  unallocated: number
  /** Every payroll row in scope: allocated + unallocated. */
  total: number
}

export function allocatePayrollToEntries(payroll: any[], laborEntries: any[]): PayrollAllocation {
  const key = (employeeId: string, week: string) => `${employeeId}|${week}`

  const payByEmpWeek = new Map<string, number>()
  for (const p of payroll) {
    const start = p.payroll_period_start || p.payroll_period_end
    if (!start) continue
    const k = key(p.employee_id, payWeekStart(String(start)))
    const cost = (p.gross_pay || 0) + (p.taxes || 0) + (p.benefits || 0)
    payByEmpWeek.set(k, (payByEmpWeek.get(k) || 0) + cost)
  }

  const weightByEmpWeek = new Map<string, number>()
  for (const e of laborEntries) {
    if (!e.date) continue
    const k = key(e.employee_id, payWeekStart(String(e.date)))
    weightByEmpWeek.set(k, (weightByEmpWeek.get(k) || 0) + entryWeight(e))
  }

  const byEntryId = new Map<string, number>()
  for (const e of laborEntries) {
    if (!e.date) continue
    const k = key(e.employee_id, payWeekStart(String(e.date)))
    const pay = payByEmpWeek.get(k)
    const totalWeight = weightByEmpWeek.get(k) || 0
    // No payroll for the week, or a zero-hour week: nothing to apportion.
    if (!pay || totalWeight <= 0) continue
    byEntryId.set(e.id, (pay * entryWeight(e)) / totalWeight)
  }

  let unallocated = 0
  let total = 0
  for (const [k, pay] of payByEmpWeek) {
    total += pay
    if (!weightByEmpWeek.get(k)) unallocated += pay
  }

  return { byEntryId, unallocated, total }
}
