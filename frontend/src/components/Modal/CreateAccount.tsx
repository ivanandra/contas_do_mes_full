import { useState } from 'react'
import { X, CreditCard, Zap, Layers } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/services/api'
import type { AccountType, Account } from '@/types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { MoneyInput } from '@/components/Input/MoneyInput'
import { IntInput } from '@/components/Input/IntInput'

// Converte NaN (valor de input vazio com valueAsNumber:true) em undefined antes do zod validar
const nanToUndef = (v: unknown) =>
  typeof v === 'number' && Number.isNaN(v) ? undefined : v

const numOpt = z.preprocess(nanToUndef, z.number().optional())
const intOpt = z.preprocess(nanToUndef, z.number().int().optional())

const schema = z.object({
  account_name: z.string().min(1, 'Nome obrigatório'),
  account_type: z.enum(['MONTHLY', 'DYNAMIC', 'INSTALLMENT']),
  description: z.string().optional(),
  value: numOpt,
  limit_value: numOpt,
  total_value: numOpt,
  number_of_installments: intOpt,
  due_date: z.preprocess(nanToUndef, z.number().int().min(1).max(31)),
})
type FormData = z.infer<typeof schema>

const TYPE_OPTIONS: { value: AccountType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'MONTHLY', label: 'Conta Fixa', desc: 'Aluguel, planos, assinaturas', icon: <CreditCard size={16} /> },
  { value: 'DYNAMIC', label: 'Conta Dinâmica', desc: 'Cartão, mercado, variáveis', icon: <Zap size={16} /> },
  { value: 'INSTALLMENT', label: 'Parcelamento', desc: 'Compras parceladas', icon: <Layers size={16} /> },
]

function getDefaults(account?: Account): Partial<FormData> {
  if (!account) return { account_type: 'MONTHLY', due_date: 10 }
  return {
    account_name: account.account_name,
    account_type: account.account_type,
    description: account.description ?? '',
    value: account.monthly_account?.value,
    limit_value: account.dynamic_account?.limit_value,
    total_value: account.installment_account?.total_value,
    number_of_installments: account.installment_account?.number_of_installments,
    due_date:
      account.monthly_account?.due_date ??
      account.dynamic_account?.due_date ??
      account.installment_account?.due_date ??
      10,
  }
}

export default function CreateAccountModal({
  onClose,
  onSuccess,
  account,
}: {
  onClose: () => void
  onSuccess: () => void
  account?: Account
}) {
  const isEdit = !!account
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: getDefaults(account),
  })
  const accountType = watch('account_type')

  const onSubmit = async (data: FormData) => {
    // Validação manual dos campos obrigatórios do tipo selecionado
    if (data.account_type === 'MONTHLY' && (!data.value || data.value <= 0)) {
      return toast.error('Informe o valor da conta')
    }
    if (data.account_type === 'DYNAMIC' && (!data.limit_value || data.limit_value <= 0)) {
      return toast.error('Informe o limite da conta')
    }
    if (data.account_type === 'INSTALLMENT') {
      if (!data.total_value || data.total_value <= 0) {
        return toast.error('Informe o valor total')
      }
      if (!data.number_of_installments || data.number_of_installments < 1) {
        return toast.error('Informe o número de parcelas')
      }
    }

    setLoading(true)
    try {
      const payload: any = {
        account_name: data.account_name,
        account_type: data.account_type,
        description: data.description,
      }
      if (data.account_type === 'MONTHLY') {
        payload.monthly_data = { value: data.value, due_date: data.due_date }
      } else if (data.account_type === 'DYNAMIC') {
        payload.dynamic_data = { limit_value: data.limit_value, due_date: data.due_date }
      } else {
        payload.installment_data = {
          total_value: data.total_value,
          number_of_installments: data.number_of_installments,
          due_date: data.due_date,
        }
      }

      if (isEdit) {
        await api.put(`/accounts/${account!.id}`, payload)
        toast.success('Conta atualizada! ✅')
      } else {
        await api.post('/accounts', payload)
        const jokes = [
          'Mais uma conta pra te fazer chorar no fim do mês! 😂',
          'Boa! Agora o Tuco vai te vigiar de perto. 👀',
          'Conta criada! Que venha o pagamento! 💸',
          'Registrado! Pode gastar... mas com juízo! 😎',
        ]
        toast.success(jokes[Math.floor(Math.random() * jokes.length)])
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? (isEdit ? 'Erro ao atualizar' : 'Erro ao criar conta'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-400">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Editar conta' : 'Nova conta'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-dark-800 hover:bg-dark-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Type selector */}
          <div>
            <label className="label">Tipo de conta</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => !isEdit && setValue('account_type', t.value)}
                  disabled={isEdit}
                  className={clsx(
                    'p-3 rounded-xl border text-left transition-all',
                    accountType === t.value
                      ? 'border-brand bg-brand/10'
                      : 'border-dark-400 hover:border-dark-500',
                    isEdit && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className={`mb-1 ${accountType === t.value ? 'text-brand' : 'text-dark-700'}`}>
                    {t.icon}
                  </div>
                  <p className={`text-xs font-semibold ${accountType === t.value ? 'text-brand' : 'text-white'}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-dark-700 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="text-xs text-dark-700 mt-2">Tipo da conta não pode ser alterado.</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="label">Nome da conta</label>
            <input type="text" placeholder="Ex: Aluguel, Cartão Nubank..." className="input-field" {...register('account_name')} />
            {errors.account_name && <p className="text-red-400 text-xs mt-1">{errors.account_name.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Descrição <span className="text-dark-700">(opcional)</span></label>
            <input type="text" placeholder="Detalhes opcionais..." className="input-field" {...register('description')} />
          </div>

          {/* Type-specific fields */}
          {accountType === 'MONTHLY' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Valor</label>
                <Controller name="value" control={control} render={({ field }) => (
                  <MoneyInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <label className="label">Dia do vencimento</label>
                <Controller name="due_date" control={control} render={({ field }) => (
                  <IntInput value={field.value} onChange={field.onChange} min={1} max={31} placeholder="10" />
                )} />
              </div>
            </div>
          )}

          {accountType === 'DYNAMIC' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Limite</label>
                <Controller name="limit_value" control={control} render={({ field }) => (
                  <MoneyInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <label className="label">Dia do vencimento</label>
                <Controller name="due_date" control={control} render={({ field }) => (
                  <IntInput value={field.value} onChange={field.onChange} min={1} max={31} placeholder="10" />
                )} />
              </div>
            </div>
          )}

          {accountType === 'INSTALLMENT' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Valor total</label>
                <Controller name="total_value" control={control} render={({ field }) => (
                  <MoneyInput value={field.value} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <label className="label">Nº de parcelas</label>
                <Controller name="number_of_installments" control={control} render={({ field }) => (
                  <IntInput value={field.value} onChange={field.onChange} min={1} placeholder="12" />
                )} />
              </div>
              <div>
                <label className="label">Dia do vencimento</label>
                <Controller name="due_date" control={control} render={({ field }) => (
                  <IntInput value={field.value} onChange={field.onChange} min={1} max={31} placeholder="10" />
                )} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar alterações' : 'Criar conta')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
