import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle,
  CreditCard, BarChart3, ArrowRight, CheckCircle, ShoppingBag,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth'
import type { AccountsSummary, Account } from '@/types'
import { formatCurrency, MONTH_NAMES } from '@/types'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

const PIE_COLORS = ['#7EC243', '#3b82f6', '#f59e0b', '#a855f7']

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [summary, setSummary] = useState<AccountsSummary | null>(null)
  const [lateAccounts, setLateAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [summaryRes, accountsRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/accounts'),
      ])
      setSummary(summaryRes.data)
      const allAccounts: Account[] = [
        ...accountsRes.data.monthly,
        ...accountsRes.data.dynamic,
        ...accountsRes.data.installment,
      ]
      setLateAccounts(allAccounts.filter((a) => a.is_late))
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetMonth() {
    const result = await Swal.fire({
      title: 'Fechar o mês?',
      html: `
        <p style="color:#aaa">Isso vai:</p>
        <ul style="color:#aaa;text-align:left;margin-top:12px;list-style:disc;padding-left:20px">
          <li>Salvar o resumo do mês</li>
          <li>Zerar as contas dinâmicas</li>
          <li>Resetar status de pagamento</li>
        </ul>
        <p style="color:#7EC243;margin-top:12px;font-weight:600">
          Tuco aprova essa responsabilidade! 👏
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Fechar mês!',
      cancelButtonText: 'Ainda não',
      reverseButtons: true,
    })
    if (!result.isConfirmed) return

    try {
      await api.post('/accounts/reset-month')
      toast.success('Mês fechado! O Tuco ficou orgulhoso. 🎉')
      loadData()
    } catch {
      toast.error('Erro ao fechar o mês')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const pieData = summary ? [
    { name: 'Fixas', value: summary.total_monthly },
    { name: 'Dinâmicas', value: summary.total_dynamic },
    { name: 'Parcelamentos', value: summary.total_installment },
    { name: 'Gastos Avulsos', value: summary.total_expenses },
  ].filter((d) => d.value > 0) : []

  const paidPercent = summary && summary.total_value > 0
    ? Math.round((summary.total_paid / summary.total_value) * 100)
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">
            Fala, <span className="text-gradient">{user?.name?.split(' ')[0]}</span>! 👋
          </h2>
          <p className="text-dark-800 mt-1">
            {MONTH_NAMES[today.getMonth()]} de {today.getFullYear()} — vamos ver onde tá indo seu dinheiro
          </p>
        </div>
        <button onClick={handleResetMonth} className="btn-secondary flex items-center gap-2">
          <CheckCircle size={16} />
          Fechar mês
        </button>
      </div>

      {/* Late accounts alert */}
      {lateAccounts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">
              {lateAccounts.length} conta{lateAccounts.length > 1 ? 's' : ''} em atraso!
            </p>
            <p className="text-red-400/70 text-sm">
              {lateAccounts.map((a) => a.account_name).join(', ')} — paga logo antes que o Tuco te zoar! 😤
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total do mês"
          value={formatCurrency((summary?.total_value ?? 0) + (summary?.total_expenses ?? 0))}
          icon={<Wallet size={20} />}
          color="text-white"
        />
        <StatCard
          label="Total pago"
          value={formatCurrency(summary?.total_paid ?? 0)}
          icon={<TrendingUp size={20} />}
          color="text-brand"
          accent
        />
        <StatCard
          label="A pagar"
          value={formatCurrency(summary?.resting_value ?? 0)}
          icon={<TrendingDown size={20} />}
          color="text-red-400"
        />
        <StatCard
          label="Gastos avulsos"
          value={formatCurrency(summary?.total_expenses ?? 0)}
          icon={<ShoppingBag size={20} />}
          color="text-purple-400"
        />
        <StatCard
          label="Em atraso"
          value={`${lateAccounts.length} conta${lateAccounts.length !== 1 ? 's' : ''}`}
          icon={<AlertTriangle size={20} />}
          color={lateAccounts.length > 0 ? 'text-yellow-400' : 'text-dark-800'}
        />
      </div>

      {/* Progress bar + Chart */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Progress */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Progresso do mês</h3>
            <span className="text-brand font-bold text-lg">{paidPercent}%</span>
          </div>
          <div className="w-full bg-dark-400 rounded-full h-3">
            <div
              className="bg-brand h-3 rounded-full transition-all duration-700"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <MiniStat label="Fixas" value={formatCurrency(summary?.total_monthly ?? 0)} color="bg-brand" />
            <MiniStat label="Dinâmicas" value={formatCurrency(summary?.total_dynamic ?? 0)} color="bg-blue-500" />
            <MiniStat label="Parcelamentos" value={formatCurrency(summary?.total_installment ?? 0)} color="bg-yellow-500" />
            <MiniStat label="Gastos" value={formatCurrency(summary?.total_expenses ?? 0)} color="bg-purple-500" />
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Distribuição</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44 text-dark-700">
              <p>Nenhuma conta cadastrada ainda</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-dark-800">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <QuickAction
          to="/accounts"
          icon={<CreditCard size={20} />}
          label="Gerenciar contas"
          desc="Fixas, dinâmicas e parcelamentos"
        />
        <QuickAction
          to="/payments"
          icon={<Wallet size={20} />}
          label="Ver pagamentos"
          desc="Histórico completo"
        />
        <QuickAction
          to="/summary"
          icon={<BarChart3 size={20} />}
          label="Histórico mensal"
          desc="Resumo por mês"
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color, accent }: {
  label: string; value: string; icon: React.ReactNode; color: string; accent?: boolean
}) {
  return (
    <div className={`card p-4 ${accent ? 'border-brand/30 glow-brand' : ''}`}>
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-dark-800 text-xs font-medium">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-dark-300 rounded-xl p-3">
      <div className={`w-2 h-2 rounded-full ${color} mb-2`} />
      <p className="text-xs text-dark-800">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  )
}

function QuickAction({ to, icon, label, desc }: {
  to: string; icon: React.ReactNode; label: string; desc: string
}) {
  return (
    <Link to={to} className="card-hover p-4 flex items-center gap-3 group">
      <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-black transition-all">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-dark-800 truncate">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-dark-600 group-hover:text-brand transition-colors shrink-0" />
    </Link>
  )
}
