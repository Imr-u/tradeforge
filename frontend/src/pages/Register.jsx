import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const setAuth  = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.post('/auth/register', { email, password })
      // Auto-login after register
      const res = await api.post('/auth/login', { email, password })
      setAuth(res.data.access_token, { email })
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forge-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg bg-forge-accent flex items-center justify-center shadow-glow">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-forge-text tracking-wide">TradeForge</span>
        </div>

        <div className="bg-forge-surface border border-forge-border rounded-2xl p-7">
          <h1 className="text-lg font-semibold text-forge-text mb-1">Create account</h1>
          <p className="text-sm text-forge-subtle mb-6">Start logging your edge.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Email',            type: 'email',    val: email,    set: setEmail,    ph: 'you@example.com' },
              { label: 'Password',         type: 'password', val: password, set: setPassword, ph: '8+ characters' },
              { label: 'Confirm Password', type: 'password', val: confirm,  set: setConfirm,  ph: '••••••••' },
            ].map(({ label, type, val, set, ph }) => (
              <div key={label}>
                <label className="block text-xs text-forge-subtle font-mono uppercase tracking-wider mb-1.5">
                  {label}
                </label>
                <input
                  type={type} required value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={ph}
                  className="w-full bg-forge-bg border border-forge-border rounded-lg px-3 py-2.5 text-sm text-forge-text placeholder:text-forge-muted focus:outline-none focus:border-forge-accent/60 transition-colors font-mono"
                />
              </div>
            ))}
            {error && (
              <p className="text-forge-red text-xs font-mono bg-forge-red/10 px-3 py-2 rounded-lg">{error}</p>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-forge-accent text-white text-sm font-medium hover:bg-forge-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-xs text-forge-subtle text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-forge-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}