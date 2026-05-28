import { useEffect, useState } from 'react'
import { Trash2, Calendar, Filter, ShoppingBag, Plus, X, Pencil } from 'lucide-react'
import api from '@/services/api'
import type { Expense } from '@/types'
import { formatCurrency, MONTH_NAMES } from '@/types'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

const METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
}

const METHOD_COLORS: Record<string, string> = {
  PIX: 'text-blue-400',
  DINHEIRO: 'text-green-400',
  DEBITO: 'text-yellow-400',
  CREDITO: 'text-purple-400',
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ description: '', amount: '', method: '', category: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadExpenses() }, [filterMonth, filterYear])

  async function loadExpenses() {
    setLoading(true)
    try {
      const res = await api.get('/expenses', { params: { month: filterMonth, year: filterYear } })
      setExpenses(res.data)
    } catch {
      toast.error('Erro ao carregar gastos')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!form.description || !form.amount) return toast.error('Descrição e valor são obrigatórios')
    setSaving(true)
    try {
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount.replace(',', '.')),
        method: form.method || null,
        category: form.category || null,
        notes: form.notes || null,
      }
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload)
        toast.success('Gasto atualizado!')
      } else {
        await api.post('/expenses', payload)
        toast.success('Gasto registrado!')
      }
      setForm({ description: '', amount: '', method: '', category: '', notes: '' })
      setEditingId(null)
      setShowForm(false)
      loadExpenses()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: String(expense.amount).replace('.', ','),
      method: expense.method ?? '',
      category: expense.category ?? '',
      notes: expense.notes ?? '',
    })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ description: '', amount: '', method: '', category: '', notes: '' })
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: 'Deletar gasto?',
      text: 'Essa ação não pode ser desfeita.',
      showCancelButton: true,
      confirmButtonText: 'Deletar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/expenses/${id}`)
      toast.success('Gasto removido')
      loadExpenses()
    } catch {
      toast.error('Erro ao deletar')
    }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters + Add */}
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
        <div className="text-sm text-dark-800">
          {expenses.length} gasto{expenses.length !== 1 ? 's' : ''} —
          <span className="text-brand font-semibold ml-1">{formatCurrency(total)}</span>
        </div>
        <button
          onClick={() => showForm ? cancelEdit() : setShowForm(true)}
          className="ml-auto btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancelar' : 'Registrar gasto'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card p-5 space-y-4 animate-fade-in">
          <h3 className="font-semibold text-white text-sm">
            {editingId ? 'Editar gasto' : 'Novo gasto avulso'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Descrição *</label>
              <input
                className="input-field"
                placeholder="Ex: Mercado, Uber, Farmácia..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Valor (R$) *</label>
              <input
                className="input-field"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Método</label>
              <select
                className="input-field"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
              >
                <option value="">Não informado</option>
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="DEBITO">Débito</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <input
                className="input-field"
                placeholder="Ex: Alimentação, Transporte..."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleAdd}
              disabled={saving}
              className="btn-primary px-6 py-2 text-sm"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center text-dark-700">
            <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-bold text-white mb-1">Nenhum gasto encontrado</p>
            <p className="text-sm">Gastos pagos no PIX, dinheiro ou débito aparecem aqui.</p>
          </div>
        ) : (
          <>
          {/* Mobile: cards stacked */}
          <div className="sm:hidden divide-y divide-dark-400">
            {expenses.map((e) => (
              <div key={e.id} className="p-4 hover:bg-dark-300/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {e.method ? (
                        <span className={`font-medium ${METHOD_COLORS[e.method] ?? 'text-dark-800'}`}>
                          {METHOD_LABELS[e.method] ?? e.method}
                        </span>
                      ) : (
                        <span className="text-dark-700">—</span>
                      )}
                      <span className="text-dark-700">·</span>
                      <span className="text-dark-800">{new Date(e.expense_date).toLocaleDateString('pt-BR')}</span>
                      {e.category && (
                        <>
                          <span className="text-dark-700">·</span>
                          <span className="text-dark-800 truncate">{e.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="font-bold text-brand whitespace-nowrap">{formatCurrency(e.amount)}</p>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2">
                  <button
                    onClick={() => handleEdit(e)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-dark-700 hover:bg-dark-400 hover:text-yellow-400 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-dark-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Deletar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-400 text-dark-800 text-xs uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Descrição</th>
                <th className="px-5 py-3 text-left">Categoria</th>
                <th className="px-5 py-3 text-left hidden md:table-cell">Data</th>
                <th className="px-5 py-3 text-left">Método</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-400">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-dark-300/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{e.description}</td>
                  <td className="px-5 py-3 text-dark-800">{e.category ?? '—'}</td>
                  <td className="px-5 py-3 text-dark-800 hidden md:table-cell">
                    {new Date(e.expense_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3">
                    {e.method
                      ? <span className={`font-medium ${METHOD_COLORS[e.method] ?? 'text-dark-800'}`}>
                          {METHOD_LABELS[e.method] ?? e.method}
                        </span>
                      : <span className="text-dark-700">—</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-brand">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(e)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-700 hover:bg-dark-400 hover:text-yellow-400 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Deletar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
