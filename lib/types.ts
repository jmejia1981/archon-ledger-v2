export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          created_at: string
          name: string
          status: 'active' | 'completed' | 'on-hold'
          budget: number
          spent: number
          start_date: string
          end_date?: string
        }
      }
      invoices: {
        Row: {
          id: string
          created_at: string
          project_id: string
          number: string
          amount: number
          status: 'draft' | 'sent' | 'paid'
          due_date: string
        }
      }
      expenses: {
        Row: {
          id: string
          created_at: string
          project_id: string
          category: string
          amount: number
          description: string
          date: string
        }
      }
      clients: {
        Row: {
          id: string
          created_at: string
          name: string
          email: string
          phone: string
          address: string
        }
      }
    }
  }
}

export interface DashboardMetrics {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  activeProjects: number
  pendingInvoices: number
  receivables: number
}
