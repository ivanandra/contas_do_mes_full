import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, Receipt, BarChart3,
  MessageCircle, LogOut, DollarSign, ShoppingBag, X, Zap, HelpCircle,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import clsx from 'clsx'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: CreditCard, label: 'Contas' },
  { to: '/payments', icon: Receipt, label: 'Pagamentos' },
  { to: '/expenses', icon: ShoppingBag, label: 'Gastos' },
  { to: '/summary', icon: BarChart3, label: 'Histórico' },
  { to: '/tuco', icon: MessageCircle, label: 'Config. Tuco' },
  { to: '/planos', icon: Zap, label: 'Planos' },
  { to: '/faq', icon: HelpCircle, label: 'FAQ' },
]

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout, user } = useAuthStore()

  return (
    <aside className={clsx(
      'w-64 bg-dark-100 border-r border-dark-400 flex flex-col shrink-0',
      'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
      'lg:static lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Logo */}
      <div className="p-6 border-b border-dark-400">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-black" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white leading-tight">Contas do Mês</p>
            <p className="text-xs text-dark-800">com o Tuco 😎</p>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-dark-800 hover:text-white hover:bg-dark-300 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand text-black'
                  : 'text-dark-800 hover:bg-dark-300 hover:text-white'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-dark-400">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-dark-800 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-dark-800
                     hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
