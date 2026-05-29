import { useLocation } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface HeaderProps {
  onMenuClick: () => void
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral das suas finanças' },
  '/accounts': { title: 'Contas', subtitle: 'Fixas, dinâmicas e parcelamentos' },
  '/payments': { title: 'Pagamentos', subtitle: 'Histórico de pagamentos' },
  '/expenses': { title: 'Gastos Avulsos', subtitle: 'PIX, dinheiro e débito' },
  '/summary': { title: 'Histórico Mensal', subtitle: 'Fechamentos por mês' },
  '/tuco': { title: 'Configurar Tuco', subtitle: 'Personalize seu assistente' },
  '/planos': { title: 'Planos', subtitle: 'Gratuito, Pro e Pro Anual' },
  '/faq': { title: 'FAQ', subtitle: 'Perguntas frequentes' },
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const page = PAGE_TITLES[pathname] ?? { title: 'Contas do Mês', subtitle: '' }

  return (
    <header className="h-16 bg-dark-100 border-b border-dark-400 px-4 lg:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-9 h-9 rounded-xl bg-dark-300 flex items-center justify-center text-dark-800 hover:text-white hover:bg-dark-400 transition-colors"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">{page.title}</h1>
          {page.subtitle && (
            <p className="text-xs text-dark-800 hidden sm:block">{page.subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-xl bg-dark-300 flex items-center justify-center text-dark-800 hover:text-white hover:bg-dark-400 transition-colors">
          <Bell size={16} />
        </button>
        <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
