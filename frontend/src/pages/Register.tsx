import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { DollarSign, Eye, EyeOff, ArrowRight, Check, X as XIcon } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[a-z]/, 'Precisa de uma letra minúscula')
    .regex(/[A-Z]/, 'Precisa de uma letra maiúscula')
    .regex(/[0-9]/, 'Precisa de um número')
    .regex(/[^A-Za-z0-9]/, 'Precisa de um caractere especial (!@#$...)'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'As senhas não coincidem',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

const PASSWORD_RULES = [
  { label: 'Pelo menos 8 caracteres',      test: (p: string) => p.length >= 8 },
  { label: 'Uma letra maiúscula',          test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Uma letra minúscula',          test: (p: string) => /[a-z]/.test(p) },
  { label: 'Um número',                    test: (p: string) => /[0-9]/.test(p) },
  { label: 'Um caractere especial (!@#$)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const register_fn = useAuthStore((s) => s.register)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
  const passwordValue = watch('password') ?? ''

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await register_fn(data.email, data.password, data.name)
      toast.success('Conta criada! O Tuco tá pronto pra te julgar... com amor. 😂')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
            <DollarSign size={18} className="text-black" />
          </div>
          <span className="font-bold text-lg text-white">Contas do Mês</span>
        </div>

        <h1 className="text-3xl font-black text-white mb-2">Criar conta</h1>
        <p className="text-dark-800 mb-8">
          O Tuco não julga.<br />
          <span className="text-brand">Só mostra onde você tá fazendo merda.</span> 😎
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input
              type="text"
              placeholder="Seu nome"
              className="input-field"
              {...register('name')}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

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
                placeholder="Senha forte"
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
            {passwordValue && (
              <ul className="mt-2 space-y-1">
                {PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(passwordValue)
                  return (
                    <li key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-brand' : 'text-dark-700'}`}>
                      {ok ? <Check size={12} /> : <XIcon size={12} />}
                      {rule.label}
                    </li>
                  )
                })}
              </ul>
            )}
            {!passwordValue && errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label">Confirmar senha</label>
            <input
              type="password"
              placeholder="••••••••"
              className="input-field"
              {...register('confirm')}
            />
            {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2"
          >
            {loading ? 'Criando conta...' : (
              <>Criar conta <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        <p className="text-center text-dark-800 mt-6 text-sm">
          Já tem conta?{' '}
          <Link to="/login" className="text-brand hover:text-brand-300 font-medium transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
