import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, ArrowLeft, Sparkles, CreditCard, MessageCircle, Smartphone, CheckCircle } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth'

interface Step {
  icon: React.ReactNode
  title: string
  body: React.ReactNode
  cta?: { label: string; to?: string }
}

const STEPS: Step[] = [
  {
    icon: <Sparkles size={28} className="text-brand" />,
    title: 'Bem-vindo ao Contas do Mês!',
    body: (
      <>
        Eu sou o <b>Tuco</b>, teu assistente financeiro com personalidade própria. 😎<br /><br />
        Em 1 minuto te mostro como tudo funciona. Bora?
      </>
    ),
  },
  {
    icon: <CreditCard size={28} className="text-brand" />,
    title: '1. Cadastra tuas contas',
    body: (
      <>
        Vai em <b>"Contas"</b> e cadastra o que você paga todo mês: aluguel, internet, cartão, parcelamentos...<br /><br />
        Tem 3 tipos: <b>Fixas</b> (mesmo valor), <b>Dinâmicas</b> (varia, tipo cartão) e <b>Parcelamentos</b>.
      </>
    ),
  },
  {
    icon: <MessageCircle size={28} className="text-brand" />,
    title: '2. Configura a personalidade do Tuco',
    body: (
      <>
        Vai em <b>"Tuco"</b> e escolhe o tom: Amoroso, Neutro ou <b>Sem Filtro</b> (esse é demais 😂).<br /><br />
        Também dá pra ajustar o nível de zoeira e como o Tuco te chama.
      </>
    ),
    cta: { label: 'Ir pras Configurações do Tuco', to: '/tuco' },
  },
  {
    icon: <Smartphone size={28} className="text-brand" />,
    title: '3. Vincula teu WhatsApp',
    body: (
      <>
        Na mesma página, vincula teu número e usa o Tuco direto no WhatsApp.<br /><br />
        Manda <code className="text-brand">Mercado 150 pix</code> ou pergunta <code className="text-brand">quanto gastei hoje?</code>. Simples assim.
      </>
    ),
  },
  {
    icon: <CheckCircle size={28} className="text-brand" />,
    title: 'Tá pronto!',
    body: (
      <>
        Agora é só usar e deixar o Tuco te ajudar a tomar vergonha na cara nos gastos. 🔥<br /><br />
        Qualquer dúvida, dá uma olhada na <b>FAQ</b> no menu.
      </>
    ),
    cta: { label: 'Começar a usar', to: '/dashboard' },
  },
]

export default function Tour({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { updateUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  async function finish(navigateTo?: string) {
    setSaving(true)
    try {
      const res = await api.put('/auth/me', { tour_completed: true })
      updateUser(res.data)
    } catch {/* segue mesmo se falhar */}
    setSaving(false)
    onClose()
    if (navigateTo) navigate(navigateTo)
  }

  function handleNext() {
    if (isLast) {
      finish(current.cta?.to)
    } else if (current.cta?.to) {
      finish(current.cta.to)
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-dark-100 border border-dark-400 rounded-2xl overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-400">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-brand' : 'w-1.5 bg-dark-500'}`}
              />
            ))}
          </div>
          <button
            onClick={() => finish()}
            className="text-xs text-dark-700 hover:text-white transition-colors"
          >
            Pular
          </button>
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
            {current.icon}
          </div>
          <h2 className="text-xl font-bold text-white mb-3">{current.title}</h2>
          <p className="text-dark-800 leading-relaxed">{current.body}</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-dark-400 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="flex items-center gap-1.5 text-sm text-dark-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          <button
            onClick={handleNext}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm"
          >
            {current.cta?.label ?? (isLast ? 'Concluir' : 'Próximo')}
            <ArrowRight size={15} />
          </button>
        </div>

      </div>
    </div>
  )
}
