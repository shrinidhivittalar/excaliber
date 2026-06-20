import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { authApi } from '@/lib/api'
import axios from 'axios'

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    return data?.error ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirm]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!token) {
      setError('Reset link is invalid. Please request a new one.')
      return
    }

    setIsSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const ambientOrbs = (
    <>
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 animate-[orb-float_12s_ease-in-out_infinite]
                      rounded-full bg-amber-500/[0.09] blur-[80px]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 animate-[orb-float_16s_ease-in-out_infinite_reverse]
                      rounded-full bg-orange-500/[0.07] blur-[60px]" />
    </>
  )

  const pageClass = "relative flex min-h-screen items-center justify-center overflow-hidden px-4 animate-[page-enter_0.25s_ease-out]"
  const cardClass = "relative w-full max-w-[400px] rounded-xl border border-white/10 bg-zinc-950 p-6 shadow-[0_0_80px_rgba(245,158,11,0.08),_0_32px_64px_rgba(0,0,0,0.8)]"

  if (!token) {
    return (
      <div className={pageClass} style={{ background: 'radial-gradient(ellipse at top, #2d1200 0%, #000 70%)' }}>
        {ambientOrbs}
        <div className={cardClass}>
          <p className="text-sm text-red-400 text-center">
            This reset link is invalid or has already been used.
          </p>
          <Button
            onClick={() => navigate('/login')}
            variant="ghost"
            className="mt-4 w-full text-zinc-400 hover:text-white"
          >
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={pageClass} style={{ background: 'radial-gradient(ellipse at top, #2d1200 0%, #000 70%)' }}>
        {ambientOrbs}
        <div className={cardClass}>
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-2xl">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-white">Password updated</h2>
            <p className="text-sm text-zinc-400">You can now sign in with your new password.</p>
          </div>
          <Button
            onClick={() => navigate('/login')}
            className={cn(
              'mt-6 h-10 w-full rounded-lg border-0 text-sm font-medium text-white',
              'bg-gradient-to-r from-amber-500 to-orange-500',
              'hover:from-amber-400 hover:to-orange-400'
            )}
          >
            Go to sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={pageClass} style={{ background: 'radial-gradient(ellipse at top, #2d1200 0%, #000 70%)' }}>
      {ambientOrbs}
      <div className={cardClass}>
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            <span className="text-amber-400">✦</span> Excaliber
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Choose a new password</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-zinc-300">New password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                className="border-white/10 bg-zinc-900 pr-10 text-white placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-zinc-300">Confirm new password</Label>
            <Input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              className={cn(
                'border-white/10 bg-zinc-900 text-white placeholder:text-zinc-500',
                confirmPassword && confirmPassword !== password && 'border-red-500/50'
              )}
            />
            {confirmPassword && confirmPassword !== password && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'h-10 w-full rounded-lg border-0 text-sm font-medium text-white',
              'bg-gradient-to-r from-amber-500 to-orange-500',
              'hover:from-amber-400 hover:to-orange-400 disabled:opacity-60'
            )}
          >
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
