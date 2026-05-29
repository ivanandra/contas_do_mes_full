import { useState } from 'react'
import { ChevronDown, HelpCircle, MessageCircle } from 'lucide-react'
import clsx from 'clsx'

interface FaqItem {
  q: string
  a: React.ReactNode
}

const FAQS: { section: string; items: FaqItem[] }[] = [
  {
    section: '🚀 Começando',
    items: [
      {
        q: 'O que é o Contas do Mês?',
        a: 'É um app de finanças pessoais com o "Tuco", um assistente sem papas na língua que te ajuda a controlar contas fixas, dinâmicas, parcelamentos e gastos avulsos — pelo app e pelo WhatsApp.',
      },
      {
        q: 'Como cadastro minha primeira conta?',
        a: <>Vai em <b>"Contas"</b> no menu lateral → clica em <b>"+ Nova conta"</b>. Escolhe o tipo (Fixa, Dinâmica ou Parcelamento), dá um nome e pronto.</>,
      },
      {
        q: 'Qual a diferença entre conta Fixa, Dinâmica e Parcelamento?',
        a: (
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Fixa:</b> mesmo valor todo mês (aluguel, internet, Netflix).</li>
            <li><b>Dinâmica:</b> valor que varia conforme você acumula (cartão de crédito, mercado fiado).</li>
            <li><b>Parcelamento:</b> compra dividida em N vezes (geladeira em 12x).</li>
          </ul>
        ),
      },
    ],
  },
  {
    section: '💸 Gastos & Contas',
    items: [
      {
        q: 'Qual a diferença entre "Gasto Avulso" e adicionar item numa conta dinâmica?',
        a: <><b>Gasto Avulso</b> é dinheiro que já saiu do bolso (PIX, dinheiro, débito). <b>Item em conta dinâmica</b> acumula pra pagar depois (crédito, fiado).</>,
      },
      {
        q: 'Como pago uma conta?',
        a: <>Em <b>"Contas"</b>, clica no ícone do cifrão ($) na conta que quer pagar. Você pode pagar integralmente ou parcialmente — o Tuco anota tudo.</>,
      },
      {
        q: 'Como o "Fechar mês" funciona?',
        a: 'No Dashboard, clica em "Fechar mês". Isso salva um resumo do mês no histórico, zera as contas dinâmicas e reseta o status de pagamento das contas fixas para o próximo mês.',
      },
      {
        q: 'Posso editar um gasto/conta?',
        a: <>Sim! Tanto em <b>Gastos Avulsos</b> quanto em <b>Contas</b>, cada item tem um ícone de lápis (amarelo) pra editar.</>,
      },
    ],
  },
  {
    section: '🤖 Tuco no WhatsApp',
    items: [
      {
        q: 'Como vinculo meu WhatsApp?',
        a: (
          <>
            <b>Importante (fase beta):</b> antes de vincular, você precisa <b>ativar manualmente</b> o Tuco no WhatsApp:
            <ol className="list-decimal pl-5 space-y-1 mt-2">
              <li>Vai em <b>"Tuco"</b> no menu</li>
              <li>Clica em <b>"Como ativar?"</b> no card "Vincular WhatsApp"</li>
              <li>Segue os 3 passos do modal (manda um código pelo WhatsApp)</li>
              <li>Volta no app, coloca seu número e clica em <b>"Salvar tudo"</b></li>
            </ol>
            Em breve teremos número oficial WhatsApp Business — aí a ativação será automática.
          </>
        ),
      },
      {
        q: 'O que posso fazer pelo WhatsApp?',
        a: (
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Registrar gasto: <code>Mercado 150 pix</code></li>
            <li>Registrar fiado: <code>marquei 30 no mercado</code></li>
            <li>Consulta: <code>quanto gastei hoje?</code></li>
            <li>Múltiplos gastos: <code>Mercado 100 e Gasolina 230</code></li>
            <li>Pagar conta: <code>paguei o aluguel</code></li>
          </ul>
        ),
      },
      {
        q: 'O Tuco entende português ruim/com erro?',
        a: 'Sim! Ele interpreta intenção, não ortografia. Pode escrever "marquei 150 mercado", "150 cerveja pix" ou "Mercado: 150" — tudo funciona.',
      },
      {
        q: 'Posso configurar a personalidade do Tuco?',
        a: <>Sim, em <b>"Tuco"</b>: escolhe o tom (Amoroso / Neutro / Sem filtro), o nível de zoeira (1-3) e como ele te chama. Suas mensagens vão ter a vibe que você escolher.</>,
      },
    ],
  },
  {
    section: '💎 Planos & Pagamento',
    items: [
      {
        q: 'Quais são os planos disponíveis?',
        a: (
          <ul className="list-disc pl-5 space-y-1.5">
            <li><b>Gratuito:</b> 5 interações com o Tuco por mês.</li>
            <li><b>Pro (R$19,90/mês):</b> Tuco ilimitado e suporte prioritário.</li>
            <li><b>Pro Anual (R$197/ano):</b> Pro com 2 meses grátis.</li>
          </ul>
        ),
      },
      {
        q: 'Como assino o Pro?',
        a: <>Vai em <b>"Planos"</b> no menu → escolhe Pro ou Pro Anual → clica em assinar → é redirecionado pro Stripe. Cartão sai automaticamente todo mês/ano.</>,
      },
      {
        q: 'Posso cancelar a qualquer momento?',
        a: 'Sim. Na página de Planos, clica em "Gerenciar assinatura" e você cai no portal do Stripe pra cancelar, atualizar cartão ou ver faturas.',
      },
    ],
  },
  {
    section: '📧 Email & Relatórios',
    items: [
      {
        q: 'Como ativar relatórios por email?',
        a: <>Em <b>"Tuco"</b> → card <b>"Relatório por email"</b> → escolhe Semanal (toda segunda 9h) ou Mensal (todo dia 1 9h).</>,
      },
      {
        q: 'O que vem no email?',
        a: 'Total gasto no período, top 5 maiores gastos, contas pendentes, e uma frase de zoeira do Tuco no fim.',
      },
    ],
  },
  {
    section: '🔒 Privacidade & Segurança',
    items: [
      {
        q: 'Meus dados estão seguros?',
        a: 'Sim. Senha criptografada com bcrypt, login via JWT, comunicação por HTTPS, e nenhum dado financeiro é compartilhado com terceiros. O Tuco usa Claude (Anthropic) só pra interpretar mensagens — sem armazenar contexto entre sessões.',
      },
      {
        q: 'Como apago minha conta?',
        a: 'Por enquanto, manda email pra suporte@contasdomes.com.br solicitando exclusão. Vamos adicionar um botão de auto-exclusão em breve.',
      },
    ],
  },
]

export default function Faq() {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
          <HelpCircle size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Perguntas frequentes</h2>
          <p className="text-dark-800 text-sm">Tira tuas dúvidas sobre o app, o Tuco e os planos.</p>
        </div>
      </div>

      {FAQS.map((section) => (
        <div key={section.section} className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-dark-400">
            <h3 className="font-bold text-white text-sm">{section.section}</h3>
          </div>
          <div className="divide-y divide-dark-400">
            {section.items.map((item, idx) => {
              const key = `${section.section}-${idx}`
              const isOpen = !!open[key]
              return (
                <div key={key}>
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-dark-300/40 transition-colors text-left"
                  >
                    <span className="font-medium text-white text-sm">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={clsx('text-dark-700 shrink-0 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-dark-800 leading-relaxed animate-fade-in">
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Contato */}
      <div className="card p-6 text-center bg-brand/5 border-brand/30">
        <MessageCircle size={32} className="text-brand mx-auto mb-3" />
        <h3 className="font-bold text-white mb-1">Não achou sua resposta?</h3>
        <p className="text-sm text-dark-800 mb-4">Manda um email que a gente responde rapidinho.</p>
        <a
          href="mailto:suporte@contasdomes.com.br"
          className="btn-primary inline-flex items-center gap-2"
        >
          Falar com suporte
        </a>
      </div>
    </div>
  )
}
