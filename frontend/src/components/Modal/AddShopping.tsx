import { useState } from 'react'
import { X, Plus, Trash2, ShoppingCart } from 'lucide-react'
import api from '@/services/api'
import type { Account, ShoppingItem } from '@/types'
import { formatCurrency } from '@/types'
import toast from 'react-hot-toast'
import { MoneyInput } from '@/components/Input/MoneyInput'

export default function AddShoppingModal({
  account,
  items,
  onClose,
  onSuccess,
  onDeleteItem,
}: {
  account: Account
  items: ShoppingItem[]
  onClose: () => void
  onSuccess: () => void
  onDeleteItem: (id: string) => void
}) {
  const [value, setValue] = useState<number | undefined>(undefined)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const currentValue = account.dynamic_account?.current_value ?? 0
  const limit = account.dynamic_account?.limit_value ?? 0
  const percent = limit > 0 ? (currentValue / limit) * 100 : 0

  async function handleAdd() {
    if (!value || value <= 0) return toast.error('Informe o valor')

    setLoading(true)
    try {
      await api.post(`/accounts/${account.id}/shopping`, {
        value: value,
        description: description || undefined,
      })

      const jokes = [
        'Anotado! Tô de olho. 👀',
        'Item registrado! Vai com calma né? 😄',
        'Guardado! Tua carteira chorou um pouquinho. 💸',
        'Registrado! O Tuco aprova... talvez. 😏',
      ]
      toast.success(jokes[Math.floor(Math.random() * jokes.length)])
      setValue(undefined)
      setDescription('')
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Erro ao adicionar item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-400">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand" />
            <h2 className="text-xl font-bold text-white">{account.account_name}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-dark-800 hover:bg-dark-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Progress */}
          <div className="bg-dark-300 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-dark-800">Utilizado</span>
              <span className="font-bold text-white">
                {formatCurrency(currentValue)} / {formatCurrency(limit)}
              </span>
            </div>
            <div className="w-full bg-dark-400 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${percent > 80 ? 'bg-red-400' : 'bg-brand'}`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            {percent > 80 && (
              <p className="text-xs text-red-400">
                Atenção! Você usou {Math.round(percent)}% do limite. 🚨
              </p>
            )}
          </div>

          {/* Add item */}
          <div className="space-y-3">
            <h4 className="font-semibold text-white text-sm">Adicionar item</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Valor</label>
                <MoneyInput value={value} onChange={setValue} />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Leite, pão..."
                  className="input-field"
                />
              </div>
            </div>
            <button onClick={handleAdd} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={16} />
              {loading ? 'Adicionando...' : 'Adicionar item'}
            </button>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">
                Itens registrados ({items.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-dark-300 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-white">{item.description || 'Item'}</p>
                      <p className="text-xs text-dark-800">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-brand">{formatCurrency(item.value)}</span>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-dark-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
