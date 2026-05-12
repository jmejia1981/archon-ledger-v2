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
