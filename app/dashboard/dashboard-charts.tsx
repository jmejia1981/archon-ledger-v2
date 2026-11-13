'use client'

import { useEffect, useState } from 'react'
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

// Recharts wraps a tick that does not fit onto further lines, and those lines are
// drawn over the neighbouring tick rather than pushing it aside. Project names run
// long enough here that every label on the budget chart landed on top of the next
// one. These ticks stay on one line and lose their tail to an ellipsis instead; the
// full text is still there as a native SVG tooltip and in the chart's own tooltip.
const CHAR_PX = 5.6 // ≈ width of one character at 11px in the UI face

// These project names share long prefixes — five of them begin "Garden State Plaza
// - " and differ only after it — so cutting the tail turns the chart into a column
// of identical labels. Past a certain length the middle goes instead, which keeps
// both the job and the part that tells it from its neighbours.
function ellipsize(s: string, max: number) {
  if (s.length <= max) return s
  if (max < 10) return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`
  const tail = Math.floor(max * 0.55)
  const head = max - tail - 1
  return `${s.slice(0, head).trimEnd()}…${s.slice(s.length - tail).trimStart()}`
}

function SingleLineTick({ x, y, payload, axisWidth, anchor = 'end', dx = 0, dy = 4 }: any) {
  const full = String(payload?.value ?? '').trim()
  // For a right-aligned axis label, x is where the text ends and the chart's left
  // edge is 0, so x itself is the room available — measured rather than assumed
  // from the axis width, which overstated it by the tick margin and pushed the
  // longest names off the left of the card. A centred tick gets its spacing passed.
  const room = anchor === 'end' ? x - 10 : axisWidth ?? 64
  const max = Math.max(6, Math.floor(room / CHAR_PX))
  return (
    <text x={x} y={y} dx={dx} dy={dy} textAnchor={anchor} fontSize={11} fill="#6B7280">
      <title>{full}</title>
      {ellipsize(full, max)}
    </text>
  )
}

// Recharts takes the axis width as a number, so the breakpoint has to be read
// rather than declared in CSS.
function useMinWidth(px: number) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [px])
  return matches
}

export function RevenueChart({ monthlyRevenueData = [] }: { monthlyRevenueData?: any[] }) {
  return (
    <div className="md:col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
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
  // 38px a row keeps a single-line 11px label clear of its neighbours, plus room
  // for the value axis and legend underneath.
  const rows = budgetVsActualData.length
  const chartHeight = Math.max(300, rows * 38 + 80)
  // A wide card can spare the room, and at 210px most of these names fit whole
  // rather than being cut back to their shared prefix.
  const AXIS_W = useMinWidth(640) ? 210 : 124

  return (
    <div className="md:col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
      <div className="pb-2">
        <h3 className="text-base font-semibold" style={{ color: '#1A3A6B' }}>Budget vs Actual Spend</h3>
      </div>
      <div>
        {/* A fixed 300px held every project, so fourteen of them left each bar about
            twenty pixels and the labels were drawn across one another. The chart now
            grows with the data and the card scrolls instead. */}
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={budgetVsActualData.length > 0 ? budgetVsActualData : []}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
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
                width={AXIS_W}
                interval={0}
                tick={<SingleLineTick />}
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
        {/* A long category overflowed its grid column and was drawn across the one
            beside it — "Uncategorized" sat on top of "Office Supplies" on a phone.
            min-w-0 lets the cell shrink so the name can truncate instead of spill,
            and a phone gets one column rather than two. */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
          {expenseCategoryData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 min-w-0">
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs truncate" style={{ color: '#6B7280' }} title={item.name}>
                {item.name}
              </span>
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
            <LineChart
              data={cashflowData.length > 0 ? cashflowData : []}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E2" vertical={false} />
              {/* A week label is wide enough that two of them collided on a phone.
                  minTickGap makes Recharts drop labels until the rest fit, and the
                  tick stays on one line rather than wrapping over its neighbour. */}
              <XAxis
                dataKey="name"
                tick={<SingleLineTick axisWidth={64} anchor="middle" dy={12} />}
                minTickGap={28}
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
    <div className="md:col-span-2 bg-white rounded-lg p-6 shadow-sm" style={{ border: '1px solid #D4D0C8' }}>
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
