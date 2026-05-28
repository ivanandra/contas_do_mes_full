export type AccountType = 'MONTHLY' | 'DYNAMIC' | 'INSTALLMENT'
export type PaidStatus = 'PAID' | 'PARTIAL' | 'NOTPAID'
export type TucoTone = 'AMOROSO' | 'NEUTRO' | 'AGRESSIVO'
export type SubscriptionPlan = 'FREE' | 'PRO' | 'PRO_ANUAL'
export type EmailReportFrequency = 'NONE' | 'WEEKLY' | 'MONTHLY'

export interface User {
  id: string
  email: string
  name: string
  whatsapp_phone?: string
  avatar_url?: string
  plan: SubscriptionPlan
  created_at: string
}

export interface TucoSettings {
  id: string
  tone: TucoTone
  zoeira_level: number
  tuco_name: string
  active: boolean
  email_report_frequency: EmailReportFrequency
}

export interface MonthlyAccount {
  id: string
  value: number
  due_date: number
}

export interface DynamicAccount {
  id: string
  limit_value: number
  current_value: number
  due_date: number
}

export interface InstallmentAccount {
  id: string
  total_value: number
  number_of_installments: number
  installments_paid: number
  installment_value: number
  due_date: number
}

export interface ShoppingItem {
  id: string
  value: number
  description?: string
  created_at: string
}

export interface Account {
  id: string
  account_name: string
  account_type: AccountType
  description?: string
  paid_status: PaidStatus
  resting_value: number
  is_late: boolean
  created_at: string
  monthly_account?: MonthlyAccount
  dynamic_account?: DynamicAccount
  installment_account?: InstallmentAccount
}

export interface AccountsGrouped {
  monthly: Account[]
  dynamic: Account[]
  installment: Account[]
}

export interface Expense {
  id: string
  description: string
  amount: number
  method?: string
  category?: string
  expense_date: string
  month: number
  year: number
  notes?: string
}

export interface Payment {
  id: string
  value_paid: number
  payment_month: number
  payment_year: number
  payment_date: string
  payment_method?: string
  is_partial: boolean
  account_name?: string
  account_total_value?: number
  receipt_image_url?: string
}

export interface AccountsSummary {
  total_monthly: number
  total_dynamic: number
  total_installment: number
  total_value: number
  total_paid: number
  resting_value: number
  late_count: number
  total_expenses: number
}

export interface MonthResume {
  id: string
  month: number
  year: number
  total_monthly: number
  total_dynamic: number
  total_installment: number
  total_value: number
  total_paid: number
  resting_value: number
  created_at: string
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  MONTHLY: 'Conta Fixa',
  DYNAMIC: 'Conta Dinâmica',
  INSTALLMENT: 'Parcelamento',
}

export const PAID_STATUS_LABELS: Record<PaidStatus, string> = {
  PAID: 'Pago',
  PARTIAL: 'Parcial',
  NOTPAID: 'Pendente',
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
