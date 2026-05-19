import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DollarSign, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast.success('Bem-vindo de volta! 🎉')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'E-mail ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex">
      {/* Left — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-dark-100 border-r border-dark-400 p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
            <DollarSign size={20} className="text-black" />
          </div>
          <span className="font-bold text-xl text-white">Contas do Mês</span>
        </div>

        <div>
          <h2 className="text-5xl font-black text-white leading-tight mb-4">
            Planilha?<br />
            <span className="text-gradient">Nem morto.</span>
          </h2>
          <p className="text-dark-800 text-lg leading-relaxed">
            Controle financeiro feito pra vida real.<br />
            Sem enrolação. Só resultado.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { emoji: '💬', text: 'Registra tudo pelo WhatsApp' },
              { emoji: '🧠', text: 'O Tuco entende até print confuso do Nubank' },
              { emoji: '😎', text: 'Responde com sarcasmo e amor' },
              { emoji: '📊', text: 'Resumo que até contador ia se orgulhar' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-dark-900">
                <span className="text-xl">{item.emoji}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-dark-700 text-sm">
          © 2025 Contas do Mês. Controle financeiro feito pra vida real.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
                <DollarSign size={18} className="text-black" />
              </div>
              <span className="font-bold text-lg text-white">Contas do Mês</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Entrar</h1>
            <p className="text-dark-800">Bem-vindo de volta! O Tuco tá esperando você. 😏</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="input-field"
                {...register('email')}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input-field pr-12"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-700 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? 'Entrando...' : (
                <>Entrar <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="text-center text-dark-800 mt-6 text-sm">
            Novo por aqui?{' '}
            <Link to="/register" className="text-brand hover:text-brand-300 font-medium transition-colors">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
