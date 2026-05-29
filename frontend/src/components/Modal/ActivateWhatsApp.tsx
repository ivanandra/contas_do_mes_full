import { X, Smartphone, Copy, ExternalLink, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '+1 415 523 8886'
const JOIN_CODE = import.meta.env.VITE_WHATSAPP_JOIN_CODE ?? 'join SEU-CODIGO'

const NUMBER_CLEAN = WHATSAPP_NUMBER.replace(/[^\d+]/g, '')
const WA_LINK = `https://wa.me/${NUMBER_CLEAN.replace('+', '')}?text=${encodeURIComponent(JOIN_CODE)}`

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text)
  toast.success(`${label} copiado!`)
}

export default function ActivateWhatsAppModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-dark-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
              <MessageCircle size={20} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Ativar Tuco no WhatsApp</h2>
              <p className="text-xs text-dark-800">3 passinhos e pronto</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-dark-800 hover:bg-dark-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Beta notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3.5 text-xs text-yellow-200">
            <span className="font-bold">🚧 Beta:</span> estamos em fase de aprovação oficial junto à Meta.
            Por enquanto é necessário <b>ativar manualmente</b> com o código abaixo. Em breve, basta salvar seu número e mandar mensagem.
          </div>

          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-brand text-black font-bold flex items-center justify-center shrink-0">1</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Salve o número do Tuco</h3>
              <p className="text-xs text-dark-800 mt-1 mb-2">Adiciona como contato (opcional, mas ajuda).</p>
              <div className="bg-dark-300 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <code className="text-brand font-mono text-sm">{WHATSAPP_NUMBER}</code>
                <button
                  onClick={() => copy(NUMBER_CLEAN, 'Número')}
                  className="p-1.5 rounded-lg text-dark-800 hover:bg-dark-400 hover:text-white transition-colors"
                  title="Copiar número"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-brand text-black font-bold flex items-center justify-center shrink-0">2</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Envie esta mensagem</h3>
              <p className="text-xs text-dark-800 mt-1 mb-2">Cole esta mensagem exatamente assim:</p>
              <div className="bg-dark-300 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                <code className="text-brand font-mono text-sm">{JOIN_CODE}</code>
                <button
                  onClick={() => copy(JOIN_CODE, 'Código')}
                  className="p-1.5 rounded-lg text-dark-800 hover:bg-dark-400 hover:text-white transition-colors"
                  title="Copiar código"
                >
                  <Copy size={14} />
                </button>
              </div>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-brand hover:text-brand-300 transition-colors"
              >
                <ExternalLink size={12} /> Abrir WhatsApp com a mensagem pronta
              </a>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-brand text-black font-bold flex items-center justify-center shrink-0">3</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Confirme seu número aqui</h3>
              <p className="text-xs text-dark-800 mt-1">
                Logo abaixo desse aviso, no card <b>"Vincular WhatsApp"</b>, coloca seu número
                <br />(formato <code className="text-brand">5511999999999</code>) e clica em <b>Salvar tudo</b>.
              </p>
            </div>
          </div>

          {/* Test */}
          <div className="bg-dark-300 rounded-xl p-4 mt-2">
            <p className="text-xs text-dark-800 mb-2 font-medium uppercase tracking-wider">Pra testar depois</p>
            <p className="text-sm text-white mb-1">Manda qualquer um destes pelo WhatsApp:</p>
            <ul className="text-xs text-dark-800 space-y-1 mt-2">
              <li>• <code className="text-brand">Mercado 150 pix</code></li>
              <li>• <code className="text-brand">marquei 30 no mercado</code></li>
              <li>• <code className="text-brand">quanto gastei hoje?</code></li>
            </ul>
          </div>

          <button onClick={onClose} className="btn-primary w-full py-2.5">
            Entendi, vou ativar
          </button>
        </div>
      </div>
    </div>
  )
}
