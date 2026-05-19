import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, CreditCard, Zap, Layers,
  ShoppingCart, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Clock, DollarSign,
} from 'lucide-react'
import api from '@/services/api'
import type { Account, AccountsGrouped as AccountsGroupedType, ShoppingItem } from '@/types'
import { formatCurrency, ACCOUNT_TYPE_LABELS } from '@/types'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import CreateAccountModal from '@/components/Modal/CreateAccount'
import PayAccountModal from '@/components/Modal/PayAccount'
import AddShoppingModal from '@/components/Modal/AddShopping'

const SECTION_ICONS = {
  monthly: <CreditCard size={18} />,
  dynamic: <Zap size={18} />,
  installment: <Layers size={18} />,
}
const SECTION_LABELS = {
  monthly: 'Contas Fixas',
  dynamic: 'Contas Dinâmicas',
  installment: 'Parcelamentos',
}

export default function Accounts() {
  const [data, setData] = useState<AccountsGroupedType>({ monthly: [], dynamic: [], installment: [] })
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [payAccount, setPayAccount] = useState<Account | null>(null)
  const [shoppingAccount, setShoppingAccount] = useState<Account | null>(null)
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => { loadAccounts() }, [])

  async function loadAccounts() {
    try {
      const res = await api.get('/accounts')
      setData(res.data)
    } catch {
      toast.error('Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    const result = await Swal.fire({
      title: `Deletar "${name}"?`,
      text: 'Essa ação não pode ser desfeita. O Tuco vai sentir falta... talvez não. 😏',
      showCancelButton: true,
      confirmButtonText: 'Deletar',
      cancelButtonText: 'Cancelar',
    })
    if (!result.isConfirmed) return
    try {
      await api.delete(`/accounts/${id}`)
      toast.success('Conta deletada!')
      loadAccounts()
    } catch {
      toast.error('Erro ao deletar')
    }
  }

  async function openShopping(account: Account) {
    setShoppingAccount(account)
    try {
      const res = await api.get(`/accounts/${account.id}/shopping`)
      setShoppingItems(res.data)
    } catch {
      setShoppingItems([])
    }
  }

  async function handleDeleteShopping(accountId: string, itemId: string) {
    try {
      await api.delete(`/accounts/${accountId}/shopping/${itemId}`)
      const res = await api.get(`/accounts/${accountId}/shopping`)
      setShoppingItems(res.data)
      loadAccounts()
      toast.success('Item removido')
    } catch {
      toast.error('Erro ao remover item')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalAccounts = data.monthly.length + data.dynamic.length + data.installment.length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-dark-800 text-sm">
            {totalAccounts} conta{totalAccounts !== 1 ? 's' : ''} cadastrada{totalAccounts !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova conta
        </button>
      </div>

      {/* Sections */}
      {(Object.keys(data) as Array<keyof AccountsGroupedType>).map((section) => (
        <AccountSection
          key={section}
          title={SECTION_LABELS[section]}
          icon={SECTION_ICONS[section]}
          accounts={data[section]}
          onPay={setPayAccount}
          onDelete={handleDelete}
          onShopping={openShopping}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      ))}

      {totalAccounts === 0 && (
        <div className="card p-12 text-center">
          <DollarSign size={48} className="text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Nenhuma conta ainda</h3>
          <p className="text-dark-800 mb-6">
            Cria sua primeira conta pra o Tuco começar a te julgar! 😂
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} className="mr-2 inline" />
            Criar primeira conta
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); loadAccounts() }}
        />
      )}
      {payAccount && (
        <PayAccountModal
          account={payAccount}
          onClose={() => setPayAccount(null)}
          onSuccess={() => { setPayAccount(null); loadAccounts() }}
        />
      )}
      {shoppingAccount && (
        <AddShoppingModal
          account={shoppingAccount}
          items={shoppingItems}
          onClose={() => { setShoppingAccount(null); setShoppingItems([]) }}
          onSuccess={() => {
            openShopping(shoppingAccount)
            loadAccounts()
          }}
          onDeleteItem={(itemId) => handleDeleteShopping(shoppingAccount.id, itemId)}
        />
      )}
    </div>
  )
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection({
  title, icon, accounts, onPay, onDelete, onShopping, expanded, setExpanded,
}: {
  title: string
  icon: React.ReactNode
  accounts: Account[]
  onPay: (a: Account) => void
  onDelete: (id: string, name: string) => void
  onShopping: (a: Account) => void
  expanded: Record<string, boolean>
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  if (accounts.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-400 flex items-center gap-2">
        <span className="text-brand">{icon}</span>
        <h3 className="font-bold text-white">{title}</h3>
        <span className="ml-auto text-xs text-dark-800 bg-dark-400 px-2 py-0.5 rounded-full">
          {accounts.length}
        </span>
      </div>
      <div className="divide-y divide-dark-400">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onPay={onPay}
            onDelete={onDelete}
            onShopping={onShopping}
            isExpanded={!!expanded[account.id]}
            onToggle={() => setExpanded((p) => ({ ...p, [account.id]: !p[account.id] }))}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Account Row ─────────────────────────────────────────────────────────────

function AccountRow({
  account, onPay, onDelete, onShopping, isExpanded, onToggle,
}: {
  account: Account
  onPay: (a: Account) => void
  onDelete: (id: string, name: string) => void
  onShopping: (a: Account) => void
  isExpanded: boolean
  onToggle: () => void
}) {
  const value = account.monthly_account?.value
    ?? account.dynamic_account?.current_value
    ?? account.installment_account?.installment_value
    ?? 0

  const limit = account.dynamic_account?.limit_value
  const progress = limit && limit > 0 ? (value / limit) * 100 : null

  return (
    <div className="px-5 py-4 hover:bg-dark-300/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Status dot */}
        <div className="shrink-0">
          {account.is_late ? (
            <AlertTriangle size={18} className="text-red-400" />
          ) : account.paid_status === 'PAID' ? (
            <CheckCircle size={18} className="text-brand" />
          ) : account.paid_status === 'PARTIAL' ? (
            <Clock size={18} className="text-yellow-400" />
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-dark-600" />
          )}
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white truncate">{account.account_name}</p>
            <PaidBadge status={account.paid_status} isLate={account.is_late} />
          </div>
          {account.description && (
            <p className="text-xs text-dark-800 truncate mt-0.5">{account.description}</p>
          )}
          {account.installment_account && (
            <p className="text-xs text-dark-700 mt-0.5">
              {account.installment_account.installments_paid}/{account.installment_account.number_of_installments} parcelas
            </p>
          )}
        </div>

        {/* Value */}
        <div className="text-right shrink-0">
          <p className="font-bold text-white">{formatCurrency(value)}</p>
          {account.resting_value > 0 && (
            <p className="text-xs text-dark-800">Resta: {formatCurrency(account.resting_value)}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {account.account_type === 'DYNAMIC' && (
            <button
              onClick={() => onShopping(account)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-700 hover:bg-dark-400 hover:text-blue-400 transition-colors"
              title="Ver itens"
            >
              <ShoppingCart size={15} />
            </button>
          )}
          {account.paid_status !== 'PAID' && (
            <button
              onClick={() => onPay(account)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-700 hover:bg-brand/10 hover:text-brand transition-colors"
              title="Pagar"
            >
              <DollarSign size={15} />
            </button>
          )}
          <button
            onClick={() => onDelete(account.id, account.account_name)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-700 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-700 hover:bg-dark-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Dynamic progress bar */}
      {progress !== null && (
        <div className="mt-3 ml-7">
          <div className="flex justify-between text-xs text-dark-800 mb-1">
            <span>{formatCurrency(value)} usado</span>
            <span>Limite: {formatCurrency(limit!)}</span>
          </div>
          <div className="w-full bg-dark-400 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${progress > 80 ? 'bg-red-400' : 'bg-brand'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 ml-7 p-3 bg-dark-300 rounded-xl text-xs text-dark-800 space-y-1 animate-fade-in">
          <p>ID: <span className="text-white font-mono">{account.id}</span></p>
          {account.monthly_account && (
            <p>Vencimento: todo dia <span className="text-white">{account.monthly_account.due_date}</span></p>
          )}
          {account.dynamic_account && (
            <p>Vencimento: todo dia <span className="text-white">{account.dynamic_account.due_date}</span></p>
          )}
          {account.installment_account && (
            <>
              <p>Total: <span className="text-white">{formatCurrency(account.installment_account.total_value)}</span></p>
              <p>Parcela: <span className="text-white">{formatCurrency(account.installment_account.installment_value)}</span></p>
              <p>Vencimento: todo dia <span className="text-white">{account.installment_account.due_date}</span></p>
            </>
          )}
          <p>Criada em: <span className="text-white">{new Date(account.created_at).toLocaleDateString('pt-BR')}</span></p>
        </div>
      )}
    </div>
  )
}

function PaidBadge({ status, isLate }: { status: string; isLate: boolean }) {
  if (isLate) return <span className="badge-late">Em atraso</span>
  if (status === 'PAID') return <span className="badge-paid">Pago</span>
  if (status === 'PARTIAL') return <span className="badge-partial">Parcial</span>
  return <span className="badge-notpaid">Pendente</span>
}

