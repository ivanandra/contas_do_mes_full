import { useEffect, useState } from 'react'
import { MessageCircle, Heart, Zap, Meh, Save, Smartphone, Mail } from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/auth'
import type { TucoTone, EmailReportFrequency } from '@/types'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const EMAIL_FREQ_OPTIONS: { value: EmailReportFrequency; label: string; desc: string; emoji: string }[] = [
  { value: 'NONE',    label: 'Nenhum',  desc: 'Não receber emails',                       emoji: '🚫' },
  { value: 'WEEKLY',  label: 'Semanal', desc: 'Toda segunda às 9h (horário Brasília)',    emoji: '📅' },
  { value: 'MONTHLY', label: 'Mensal',  desc: 'Todo dia 1 às 9h (horário Brasília)',      emoji: '🗓️' },
]

const TONES: { value: TucoTone; label: string; desc: string; emoji: string; icon: React.ReactNode }[] = [
  {
    value: 'AMOROSO',
    label: 'Amoroso',
    desc: 'Carinhoso, encorajador e celebra cada conquista. O melhor amigo financeiro.',
    emoji: '🥰',
    icon: <Heart size={20} />,
  },
  {
    value: 'NEUTRO',
    label: 'Neutro',
    desc: 'Direto ao ponto, levemente bem-humorado. Equilíbrio perfeito entre humor e seriedade.',
    emoji: '😎',
    icon: <Meh size={20} />,
  },
  {
    value: 'AGRESSIVO',
    label: 'Sem filtro',
    desc: 'Sarcástico, direto e sem papas na língua. A verdade dói mas ajuda.',
    emoji: '🔥',
    icon: <Zap size={20} />,
  },
]

const ZOEIRA_LEVELS = [
  { value: 1, label: 'Suave', desc: 'Comentários gentis', emoji: '😊' },
  { value: 2, label: 'Médio', desc: 'Piadas contextuais', emoji: '😄' },
  { value: 3, label: 'Pesado', desc: 'Zoeira total, sem perdão', emoji: '😂' },
]

export default function TucoSettings() {
  const { user, updateUser } = useAuthStore()
  const [tone, setTone] = useState<TucoTone>('NEUTRO')
  const [zoeira, setZoeira] = useState(2)
  const [name, setName] = useState('chefe')
  const [active, setActive] = useState(true)
  const [emailFreq, setEmailFreq] = useState<EmailReportFrequency>('NONE')
  const [phone, setPhone] = useState(user?.whatsapp_phone ?? '')
  const [loading, setLoading] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [previewMsg, setPreviewMsg] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    try {
      const res = await api.get('/dashboard/tuco-settings')
      setTone(res.data.tone)
      setZoeira(res.data.zoeira_level)
      setName(res.data.tuco_name)
      setActive(res.data.active)
      setEmailFreq(res.data.email_report_frequency ?? 'NONE')
    } catch {/* usa defaults */}
  }

  async function saveSettings() {
    setLoading(true)
    try {
      await api.put('/dashboard/tuco-settings', {
        tone, zoeira_level: zoeira, tuco_name: name, active,
        email_report_frequency: emailFreq,
      })
      toast.success('Configurações do Tuco salvas! ✅')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  async function savePhone() {
    setSavingPhone(true)
    try {
      const res = await api.put('/auth/me', { whatsapp_phone: phone || null })
      updateUser(res.data)
      toast.success('Número WhatsApp atualizado! 📱')
    } catch (err: any) {
      toast.error(err.response?.data?.detail ?? 'Erro ao salvar número')
    } finally {
      setSavingPhone(false)
    }
  }

  async function generatePreview() {
    setLoadingPreview(true)
    try {
      // Simula uma mensagem de preview
      const examples = [
        'Cerveja: 45',
        'iFood: 89',
        'Academia: 120',
        'Gasolina: 200',
        'Supermercado: 350',
      ]
      const msg = examples[Math.floor(Math.random() * examples.length)]
      toast(`Simulando: "${msg}"`, { icon: '💬' })
      // Aqui poderia chamar um endpoint /api/tuco/preview
      await new Promise((r) => setTimeout(r, 800))
      const previews: Record<TucoTone, Record<number, string[]>> = {
        AMOROSO: {
          1: [`Anotado com carinho, ${name}! 💚`, `Registrado! Você tá indo bem, ${name}! 🌟`, `Guardado! Orgulho de você, ${name}! 💪`],
          2: [`Anotado, ${name}! Tô de olho no seu bolso! 💚`, `Registrado! Vai com calma né, ${name}? 😄`],
          3: [`ANOTADO, ${name}! Mas hein... gastando isso tudo? 😂 Te amo mesmo assim! 💚`],
        },
        NEUTRO: {
          1: [`Anotado, ${name}!`, `Registrado, ${name}.`, `Ok, guardei aqui.`],
          2: [`Anotado, ${name}! Tô de olho. 😎`, `Registrado! Todo mês é isso né, ${name}? 😄`],
          3: [`Anotado, ${name}! Mais um pro contador chorar. 😂`, `Registrado! Teu bolso agradece... ou não. 😅`],
        },
        AGRESSIVO: {
          1: [`Anotado, ${name}.`, `Ok, ${name}.`, `Registrado.`],
          2: [`Anotado, ${name}. De novo. Todo mês. Sério? 😤`, `Registrado. O iFood agradece sua fidelidade, ${name}. 🛵`],
          3: [`Outro gasto, ${name}? Teu fígado vai na frente. 😂`, `Anotado! Mas se tivesse guardado tudo isso, ${name}... 🤦`],
        },
      }
      const options = previews[tone]?.[zoeira] ?? previews.NEUTRO[2]
      setPreviewMsg(options[Math.floor(Math.random() * options.length)])
    } finally {
      setLoadingPreview(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Tom do Tuco */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle size={20} className="text-brand" />
          <h3 className="font-bold text-white">Tom do Tuco</h3>
        </div>
        <div className="grid gap-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={clsx(
                'flex items-start gap-4 p-4 rounded-xl border text-left transition-all',
                tone === t.value
                  ? 'border-brand bg-brand/10'
                  : 'border-dark-400 hover:border-dark-500 hover:bg-dark-300'
              )}
            >
              <span className="text-2xl">{t.emoji}</span>
              <div>
                <p className={`font-semibold ${tone === t.value ? 'text-brand' : 'text-white'}`}>
                  {t.label}
                </p>
                <p className="text-sm text-dark-800 mt-0.5">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Nível de zoeira */}
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white">Nível de zoeira</h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {ZOEIRA_LEVELS.map((z) => (
            <button
              key={z.value}
              onClick={() => setZoeira(z.value)}
              className={clsx(
                'p-4 rounded-xl border text-center transition-all',
                zoeira === z.value
                  ? 'border-brand bg-brand/10'
                  : 'border-dark-400 hover:border-dark-500 hover:bg-dark-300'
              )}
            >
              <div className="text-2xl mb-1">{z.emoji}</div>
              <p className={`text-sm font-semibold ${zoeira === z.value ? 'text-brand' : 'text-white'}`}>
                {z.label}
              </p>
              <p className="text-xs text-dark-800">{z.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Apelido do usuário */}
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-white">Como o Tuco vai te chamar?</h3>
        <div>
          <label className="label">Seu apelido</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="chefe"
            maxLength={50}
            className="input-field"
          />
          <p className="text-xs text-dark-700 mt-1.5">
            Pode ser seu nome, apelido, "chefe", "patrão"... o Tuco vai usar isso pra te chamar.
          </p>
        </div>

        {/* Preview */}
        <div className="bg-dark-300 rounded-xl p-4">
          <p className="text-xs text-dark-800 mb-3 font-medium uppercase tracking-wider">Preview de mensagem</p>
          <button
            onClick={generatePreview}
            disabled={loadingPreview}
            className="text-sm text-brand hover:text-brand-300 transition-colors mb-3"
          >
            {loadingPreview ? 'Gerando...' : '↻ Gerar exemplo'}
          </button>
          {previewMsg && (
            <div className="bg-dark-200 rounded-xl p-3 border border-dark-400 animate-fade-in">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 bg-brand rounded-full flex items-center justify-center text-black text-xs font-bold shrink-0">
                  T
                </div>
                <p className="text-sm text-white">{previewMsg}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={20} className="text-brand" />
          <h3 className="font-bold text-white">Vincular WhatsApp</h3>
        </div>
        <p className="text-sm text-dark-800">
          Cadastre seu número para usar o Tuco pelo WhatsApp.
          Depois de salvar, mande qualquer mensagem para o número do Tuco para ativar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5511999999999 (sem + ou espaços)"
            className="input-field flex-1"
          />
          <button
            onClick={savePhone}
            disabled={savingPhone}
            className="btn-primary px-5 shrink-0"
          >
            {savingPhone ? '...' : 'Salvar'}
          </button>
        </div>
        <div className="bg-dark-300 rounded-xl p-3 text-xs text-dark-800">
          <p className="font-medium text-white mb-1">Como usar pelo WhatsApp:</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Registrar gasto: <span className="text-brand font-mono">Mercado: 150</span></li>
            <li>Ver hoje: <span className="text-brand font-mono">quanto gastei hoje?</span></li>
            <li>Resumo: <span className="text-brand font-mono">resumo do mês</span></li>
            <li>Saldo: <span className="text-brand font-mono">qual meu saldo?</span></li>
          </ul>
        </div>
      </div>

      {/* Relatório por email */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-brand" />
          <h3 className="font-bold text-white">Relatório por email</h3>
        </div>
        <p className="text-sm text-dark-800">
          Receba um resumo financeiro do Tuco direto na sua caixa de entrada — com gastos, contas pendentes e a zoeira de sempre.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {EMAIL_FREQ_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setEmailFreq(opt.value)}
              className={clsx(
                'p-4 rounded-xl border text-center transition-all',
                emailFreq === opt.value
                  ? 'border-brand bg-brand/10'
                  : 'border-dark-400 hover:border-dark-500 hover:bg-dark-300'
              )}
            >
              <div className="text-2xl mb-1">{opt.emoji}</div>
              <p className={`text-sm font-semibold ${emailFreq === opt.value ? 'text-brand' : 'text-white'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-dark-800 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
        {emailFreq !== 'NONE' && user?.email && (
          <div className="bg-dark-300 rounded-xl p-3 text-xs text-dark-800">
            📬 Será enviado para <span className="text-brand font-medium">{user.email}</span>
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={saveSettings}
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
      >
        <Save size={18} />
        {loading ? 'Salvando...' : 'Salvar configurações do Tuco'}
      </button>
    </div>
  )
}
