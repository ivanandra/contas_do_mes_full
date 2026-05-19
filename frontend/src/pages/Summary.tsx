import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '@/services/api'
import type { MonthResume } from '@/types'
import { formatCurrency, MONTH_NAMES } from '@/types'
import toast from 'react-hot-toast'

export default function Summary() {
  const [resumes, setResumes] = useState<MonthResume[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => { loadResumes() }, [year])

  async function loadResumes() {
    setLoading(true)
    try {
      const res = await api.get('/dashboard/resume', { params: { year } })
      setResumes(res.data)
    } catch {
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }

  const chartData = resumes.map((r) => ({
    name: MONTH_NAMES[r.month - 1].substring(0, 3),
    Fixas: r.total_monthly,
    Dinâmicas: r.total_dynamic,
    Parcelamentos: r.total_installment,
    Pago: r.total_paid,
  }))

  const totalYear = resumes.reduce((s, r) => s + r.total_value, 0)
  const paidYear = resumes.reduce((s, r) => s + r.total_paid, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Year filter */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[2024, 2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                year === y ? 'bg-brand text-black' : 'bg-dark-300 text-dark-800 hover:text-white'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="text-sm text-dark-800">
          Total do ano:{' '}
          <span className="text-white font-bold">{formatCurrency(totalYear)}</span>
          {' · '}
          Pago:{' '}
          <span className="text-brand font-bold">{formatCurrency(paidYear)}</span>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold text-white mb-4">Gastos mensais — {year}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number, name: string) => [formatCurrency(v), name]}
                contentStyle={{ background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#fff' }}
              />
              <Bar dataKey="Fixas" fill="#7EC243" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dinâmicas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Parcelamentos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-dark-400">
          <h3 className="font-bold text-white">Histórico de fechamentos</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="p-10 text-center text-dark-700">
            <p className="font-bold text-white mb-1">Nenhum fechamento registrado</p>
            <p className="text-sm">Use "Fechar mês" no Dashboard para criar histórico</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-400 text-dark-800 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Mês</th>
                  <th className="px-5 py-3 text-right hidden sm:table-cell">Fixas</th>
                  <th className="px-5 py-3 text-right hidden md:table-cell">Dinâmicas</th>
                  <th className="px-5 py-3 text-right hidden lg:table-cell">Parcelamentos</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Pago</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-400">
                {resumes.map((r) => (
                  <tr key={r.id} className="hover:bg-dark-300/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">
                      {MONTH_NAMES[r.month - 1]} / {r.year}
                    </td>
                    <td className="px-5 py-3 text-right text-dark-800 hidden sm:table-cell">
                      {formatCurrency(r.total_monthly)}
                    </td>
                    <td className="px-5 py-3 text-right text-dark-800 hidden md:table-cell">
                      {formatCurrency(r.total_dynamic)}
                    </td>
                    <td className="px-5 py-3 text-right text-dark-800 hidden lg:table-cell">
                      {formatCurrency(r.total_installment)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-white">
                      {formatCurrency(r.total_value)}
                    </td>
                    <td className="px-5 py-3 text-right text-brand font-semibold">
                      {formatCurrency(r.total_paid)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${r.resting_value > 0 ? 'text-red-400' : 'text-brand'}`}>
                      {formatCurrency(r.resting_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
