import { useState } from 'react'
import { X } from 'lucide-react'
import api from '@/services/api'
import type { Account } from '@/types'
import { formatCurrency } from '@/types'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { MoneyInput } from '@/components/Input/MoneyInput'

export default function PayAccountModal({
  account,
  onClose,
  onSuccess,
}: {
  account: Account
  onClose: () => void
  onSuccess: () => void
}) {
  const totalValue =
    account.monthly_account?.value ??
    account.dynamic_account?.current_value ??
    account.installment_account?.installment_value ??
    0

  const [value, setValue] = useState<number | undefined>(
    account.resting_value > 0 ? account.resting_value : totalValue
  )
  const [method, setMethod] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    if (!value || value <= 0) return toast.error('Informe o valor')
    const v = value

    const isPartial = v < totalValue
    if (isPartial) {
      const result = await Swal.fire({
        title: 'Pagamento parcial?',
        html: `Você vai pagar <strong style="color:#7EC243">${formatCurrency(v)}</strong> de <strong>${formatCurrency(totalValue)}</strong>.<br><br>O Tuco vai anotar como parcial. 😤`,
        showCancelButton: true,
        confirmButtonText: 'Confirmar parcial',
        cancelButtonText: 'Cancelar',
      })
      if (!result.isConfirmed) return
    }

    // Última parcela?
    if (account.installment_account) {
      const inst = account.installment_account
      if (inst.installments_paid + 1 >= inst.number_of_installments) {
        await Swal.fire({
          title: '🎉 Última parcela!',
          html: `Parabéns! Você está quitando <strong>${account.account_name}</strong>!<br>
            <span style="color:#7EC243">O Tuco tá orgulhoso de você! 🏆</span>`,
          confirmButtonText: 'Pagar e quitar!',
        })
      }
    }

    setLoading(true)
    try {
      await api.post(`/accounts/${account.id}/pay`, null, {
        params: { value_paid: v, payment_method: method || undefined },
      })
      toast.success(`Pagamento de ${formatCurrency(v)} registrado! 💰`)
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Erro ao registrar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-400">
          <h2 className="text-xl font-bold text-white">Registrar pagamento</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-dark-800 hover:bg-dark-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-dark-300 rounded-xl p-4">
            <p className="text-sm text-dark-800">Conta</p>
            <p className="text-lg font-bold text-white">{account.account_name}</p>
            <p className="text-brand font-semibold">{formatCurrency(totalValue)}</p>
          </div>

          <div>
            <label className="label">Valor a pagar</label>
            <MoneyInput value={value} onChange={setValue} />
            {value !== undefined && value < totalValue && value > 0 && (
              <p className="text-yellow-400 text-xs mt-1">
                Pagamento parcial — resta {formatCurrency(totalValue - value)}
              </p>
            )}
          </div>

          <div>
            <label className="label">Método de pagamento <span className="text-dark-700">(opcional)</span></label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="input-field"
            >
              <option value="">— Selecionar —</option>
              <option value="pix">Pix</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="boleto">Boleto</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handlePay} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Registrando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
