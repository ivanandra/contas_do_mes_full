import { useEffect, useState } from 'react'
import { Trash2, Image, Calendar, Filter } from 'lucide-react'
import api from '@/services/api'
import type { Payment } from '@/types'
import { formatCurrency, MONTH_NAMES } from '@/types'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())

  useEffect(() => { loadPayments() }, [filterMonth, filterYear])

  async function loadPayments() {
    setLoading(true)
    try {
      const res = await api.get('/payments', {
        params: { month: filterMonth, year: filterYear },
      })
      setPayments(res.data)
    } catch {
      toast.error('Erro ao carregar pagamentos')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Deletar pagamento?',
      text: 'Essa ação não pode ser desfeita.',
      showCancelButton: true,
      confirmButtonText: 'Deletar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/payments/${id}`)
      toast.success('Pagamento removido')
      loadPayments()
    } catch {
      toast.error('Erro ao deletar')
    }
  }

  const total = payments.reduce((s, p) => s + p.value_paid, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-dark-200 border border-dark-400 rounded-xl px-3 py-2">
          <Filter size={16} className="text-dark-800" />
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="bg-transparent text-white text-sm outline-none"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i} value={i + 1} className="bg-dark-200">{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-dark-200 border border-dark-400 rounded-xl px-3 py-2">
          <Calendar size={16} className="text-dark-800" />
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="bg-transparent text-white text-sm outline-none"
          >
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y} className="bg-dark-200">{y}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-dark-800">
          {payments.length} pagamento{payments.length !== 1 ? 's' : ''} —
          <span className="text-brand font-semibold ml-1">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-dark-700">
            <p className="text-lg font-bold text-white mb-1">Nenhum pagamento encontrado</p>
            <p className="text-sm">Paga suas contas e elas aparecem aqui! 😅</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-400 text-dark-800 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Conta</th>
                <th className="px-5 py-3 text-left hidden md:table-cell">Data</th>
                <th className="px-5 py-3 text-left hidden sm:table-cell">Método</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-400">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-dark-300/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{p.account_name ?? '—'}</td>
                  <td className="px-5 py-3 text-dark-800 hidden md:table-cell">
                    {new Date(p.payment_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-dark-800 hidden sm:table-cell capitalize">
                    {p.payment_method ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    {p.is_partial
                      ? <span className="badge-partial">Parcial</span>
                      : <span className="badge-paid">Completo</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-brand">
                    {formatCurrency(p.value_paid)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.receipt_image_url && (
                        <a
                          href={p.receipt_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-700 hover:bg-dark-400 hover:text-blue-400 transition-colors"
                          title="Ver comprovante"
                        >
                          <Image size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
