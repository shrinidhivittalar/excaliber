import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    return data?.error ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export default function AuthPage() {
  const navigate = useNavigate()
  const { login, register, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white/40">
        Loading...
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const [tab, setTab] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (tab === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)
    try {
      if (tab === 'signin') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-[400px] rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            ✦ AI Drawing Engine
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in to save your drawings
          </p>
        </header>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as 'signin' | 'register')
            setError(null)
          }}
        >
          <TabsList className="mb-6 grid w-full grid-cols-2 bg-zinc-900">
            <TabsTrigger value="signin" className="text-zinc-300 data-active:text-white">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="register" className="text-zinc-300 data-active:text-white">
              Create Account
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="border-white/10 bg-zinc-900 text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="border-white/10 bg-zinc-900 pr-10 text-white placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'h-10 w-full rounded-lg border-0 bg-white text-sm font-medium text-black',
              'hover:bg-white/90 disabled:opacity-60'
            )}
          >
            {isSubmitting
              ? 'Please wait…'
              : tab === 'signin'
                ? 'Sign In'
                : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
