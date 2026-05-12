'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
const COLORS = ['#1A3A6B', '#C8B89A', '#8B9A7D', '#D4A574', '#7A8B99', '#B8A586']

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value}`
}

export function RevenueChart({ monthlyRevenueData = [] }: { monthlyRevenueData?: any[] }) {
  return (
    <div className="col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Revenue vs Expenses</h3>
      </div>
      <div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyRevenueData.length > 0 ? monthlyRevenueData : []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A3A6B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1A3A6B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C8B89A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C8B89A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E8E6E2' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D4D0C8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#1A3A6B"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="#C8B89A"
                strokeWidth={2}
                fill="url(#colorExpenses)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function BudgetVsActualChart({ budgetVsActualData = [] }: { budgetVsActualData?: any[] }) {
  return (
    <div className="col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Budget vs Actual Spend</h3>
      </div>
      <div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetVsActualData.length > 0 ? budgetVsActualData : []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E2" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E8E6E2' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D4D0C8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#E8E6E2" radius={[0, 4, 4, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#1A3A6B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function ExpenseBreakdownChart({ expenseCategoryData = [] }: { expenseCategoryData?: any[] }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Expense Breakdown</h3>
      </div>
      <div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseCategoryData.length > 0 ? expenseCategoryData : []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {expenseCategoryData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D4D0C8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {expenseCategoryData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs" style={{ color: '#6B7280' }}>{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CashflowChart({ cashflowData = [] }: { cashflowData?: any[] }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Weekly Cashflow</h3>
      </div>
      <div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cashflowData.length > 0 ? cashflowData : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E8E6E2' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D4D0C8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Cashflow"
                stroke="#8B9A7D"
                strokeWidth={2}
                dot={{ fill: '#8B9A7D', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#8B9A7D' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function ProfitTrendChart({ monthlyRevenueData = [] }: { monthlyRevenueData?: any[] }) {
  return (
    <div className="col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Profit Trend</h3>
      </div>
      <div>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyRevenueData.length > 0 ? monthlyRevenueData : []}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B9A7D" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8B9A7D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={{ stroke: '#E8E6E2' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D4D0C8',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Net Profit"
                stroke="#8B9A7D"
                strokeWidth={2}
                fill="url(#colorProfit)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
                                                                                                                                             