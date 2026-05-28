import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Zap, Crown, Sparkles, ExternalLink } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'
import type { SubscriptionPlan } from '@/types'
import clsx from 'clsx'

const FREE_FEATURES = [
  '5 interações com o Tuco por mês',
  'Contas fixas, dinâmicas e parcelamentos',
  'Fechamento mensal',
  'Dashboard financeiro completo',
  'Gastos avulsos (PIX, dinheiro, débito)',
]

const PRO_FEATURES = [
  'Tuco ilimitado no WhatsApp',
  'Múltiplos gastos por mensagem',
  'Tudo do plano Gratuito',
  'Prioridade no suporte',
  'Novidades em primeira mão',
]

const PRO_ANUAL_FEATURES = [
  'Tuco ilimitado no WhatsApp',
  'Múltiplos gastos por mensagem',
  'Tudo do plano Gratuito',
  '2 meses grátis — economize R$40,80',
  'Prioridade máxima no suporte',
]

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  FREE: 'Gratuito',
  PRO: 'Pro',
  PRO_ANUAL: 'Pro Anual',
}

export default function Plans() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const currentPlan: SubscriptionPlan = user?.plan ?? 'FREE'

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Assinatura ativada! Bem-vindo ao Pro! 🎉')
    }
  }, [searchParams])

  async function handleCheckout(plan: 'PRO' | 'PRO_ANUAL') {
    setLoading(plan)
    try {
      const res = await api.post('/billing/checkout', { plan })
      window.location.href = res.data.url
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Erro ao iniciar checkout')
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const res = await api.get('/billing/portal')
      window.location.href = res.data.url
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Erro ao acessar portal')
      setLoading(null)
    }
  }

  const isPro = currentPlan !== 'FREE'

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Planos</h2>
        <p className="text-dark-800 mt-1">Escolha o plano ideal para o seu controle financeiro</p>

        {isPro && (
          <div className="mt-4 flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand/10 border border-brand/30 rounded-lg">
              <Zap size={14} className="text-brand" />
              <span className="text-sm text-brand font-medium">
                Plano atual: {PLAN_LABELS[currentPlan]}
              </span>
            </div>
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="inline-flex items-center gap-1.5 text-sm text-dark-800 hover:text-white transition-colors"
            >
              <ExternalLink size={14} />
              {loading === 'portal' ? 'Abrindo...' : 'Gerenciar assinatura'}
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FREE */}
        <div className={clsx(
          'card p-6 flex flex-col',
          currentPlan === 'FREE' && 'border border-dark-500'
        )}>
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-800 font-semibold text-sm uppercase tracking-wider">Gratuito</span>
              {currentPlan === 'FREE' && (
                <span className="text-xs bg-dark-400 text-dark-800 px-2 py-0.5 rounded-full">Atual</span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">R$ 0</p>
            <p className="text-dark-800 text-sm mt-1">para sempre</p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-dark-800">
                <Check size={15} className="text-dark-600 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          <div className="h-10 flex items-center justify-center rounded-xl bg-dark-400 text-dark-700 text-sm font-medium">
            {currentPlan === 'FREE' ? 'Plano atual' : 'Plano Gratuito'}
          </div>
        </div>

        {/* PRO */}
        <div className={clsx(
          'card p-6 flex flex-col border-2 relative',
          currentPlan === 'PRO' ? 'border-brand' : 'border-brand/40'
        )}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-brand text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={11} />
              Mais popular
            </span>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-brand font-semibold text-sm uppercase tracking-wider">Pro</span>
              {currentPlan === 'PRO' && (
                <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">Atual</span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">R$ 19,90</p>
            <p className="text-dark-800 text-sm mt-1">por mês</p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-white">
                <Check size={15} className="text-brand shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          {currentPlan === 'PRO' ? (
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="btn-primary w-full py-2.5 text-sm"
            >
              Gerenciar assinatura
            </button>
          ) : currentPlan === 'FREE' ? (
            <button
              onClick={() => handleCheckout('PRO')}
              disabled={loading === 'PRO'}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {loading === 'PRO' ? 'Redirecionando...' : 'Assinar Pro'}
            </button>
          ) : (
            <div className="h-10 flex items-center justify-center rounded-xl bg-dark-400 text-dark-700 text-sm font-medium">
              Incluído no Anual
            </div>
          )}
        </div>

        {/* PRO ANUAL */}
        <div className={clsx(
          'card p-6 flex flex-col relative',
          currentPlan === 'PRO_ANUAL' ? 'border border-yellow-500/60' : 'border border-yellow-500/20'
        )}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Crown size={11} />
              Melhor valor
            </span>
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-yellow-400 font-semibold text-sm uppercase tracking-wider">Pro Anual</span>
              {currentPlan === 'PRO_ANUAL' && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">Atual</span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">R$ 197</p>
            <p className="text-dark-800 text-sm mt-1">por ano <span className="text-yellow-400 font-medium">≈ R$16,42/mês</span></p>
          </div>

          <ul className="space-y-2.5 flex-1 mb-6">
            {PRO_ANUAL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-white">
                <Check size={15} className="text-yellow-400 shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>

          {currentPlan === 'PRO_ANUAL' ? (
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="w-full py-2.5 rounded-xl bg-yellow-500 text-black font-semibold text-sm hover:bg-yellow-400 transition-colors"
            >
              Gerenciar assinatura
            </button>
          ) : (
            <button
              onClick={() => handleCheckout('PRO_ANUAL')}
              disabled={!!loading}
              className="w-full py-2.5 rounded-xl bg-yellow-500 text-black font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {loading === 'PRO_ANUAL' ? 'Redirecionando...' : 'Assinar Anual'}
            </button>
          )}
        </div>
      </div>

      {/* Comparison table — só desktop (no mobile os 3 cards acima já cobrem tudo) */}
      <div className="card overflow-hidden hidden md:block">
        <div className="p-5 border-b border-dark-400">
          <h3 className="font-bold text-white">Comparação completa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-400">
                <th className="text-left p-4 text-dark-800 font-medium">Recurso</th>
                <th className="text-center p-4 text-dark-800 font-medium">Gratuito</th>
                <th className="text-center p-4 text-brand font-medium">Pro</th>
                <th className="text-center p-4 text-yellow-400 font-medium">Pro Anual</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Contas (fixas, dinâmicas, parcelamentos)', free: true, pro: true, anual: true },
                { label: 'Dashboard financeiro', free: true, pro: true, anual: true },
                { label: 'Fechamento mensal', free: true, pro: true, anual: true },
                { label: 'Tuco no WhatsApp', free: '5/mês', pro: 'Ilimitado', anual: 'Ilimitado' },
                { label: 'Múltiplos gastos por mensagem', free: '5/mês', pro: true, anual: true },
                { label: 'Suporte prioritário', free: false, pro: true, anual: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-dark-400/50 last:border-0">
                  <td className="p-4 text-white">{row.label}</td>
                  <td className="p-4 text-center">{renderCell(row.free)}</td>
                  <td className="p-4 text-center">{renderCell(row.pro)}</td>
                  <td className="p-4 text-center">{renderCell(row.anual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function renderCell(value: boolean | string) {
  if (value === true) return <Check size={16} className="text-brand mx-auto" />
  if (value === false) return <span className="text-dark-600">—</span>
  return <span className="text-dark-800 font-medium">{value}</span>
}
