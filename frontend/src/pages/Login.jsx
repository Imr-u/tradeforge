import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const [tab,      setTab]      = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const setAuth  = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  async function handleSignIn(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      setAuth(res.data.access_token, { email })
      navigate('/dashboard')
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Invalid credentials')
    } finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault(); setError(''); setLoading(true)
    if (password !== confirm) { setError('Passwords do not match'); setLoading(false); return }
    try {
      await api.post('/auth/register', { email, password })
      const res = await api.post('/auth/login', { email, password })
      setAuth(res.data.access_token, { email })
      navigate('/dashboard')
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Registration failed')
    } finally { setLoading(false) }
  }

  function demoLogin() {
    setEmail('demo@tradeforge.app'); setPassword('demo1234')
  }

  return (
    <div className="auth-root">
      {/* Grid background */}
      <div className="auth-grid" />
      <div className="auth-vignette" />

      <div className="auth-wrap">
        {/* Logo */}
        <div className="auth-logo">
          <span className="logo-dot" />
          <span className="logo-text">TradeForge</span>
        </div>

        <div className="auth-card">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to your trading journal</p>

          {/* Tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => { setTab('signin'); setError('') }}
            >Sign In</button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setError('') }}
            >Create Account</button>
          </div>

          {tab === 'signin' ? (
            <form onSubmit={handleSignIn} className="auth-form">
              <AuthField label="Email">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </AuthField>
              <AuthField label="Password">
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </AuthField>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="auth-form">
              <AuthField label="Name">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
              </AuthField>
              <AuthField label="Email">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </AuthField>
              <AuthField label="Password">
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" />
              </AuthField>
              <AuthField label="Confirm Password">
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
              </AuthField>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          <p className="auth-demo">
            Just exploring?{' '}
            <button onClick={demoLogin} className="auth-demo-link">Enter as Demo User →</button>
          </p>
        </div>
      </div>

      <style>{`
        .auth-root {
          min-height: 100vh;
          background: #0d0f14;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        .auth-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .auth-vignette {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at center, transparent 40%, #0d0f14 100%);
          pointer-events: none;
        }
        .auth-wrap {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center;
          width: 100%; max-width: 400px; padding: 0 20px;
        }
        .auth-logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 32px;
        }
        .logo-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #a8c5a0;
          box-shadow: 0 0 8px rgba(168,197,160,0.6);
        }
        .logo-text {
          font-size: 20px; font-weight: 700;
          color: #e8eaf0; letter-spacing: 0.5px;
        }
        .auth-card {
          width: 100%;
          background: #161920;
          border: 1px solid #252a38;
          border-radius: 16px;
          padding: 28px;
        }
        .auth-title {
          font-size: 20px; font-weight: 700;
          color: #e8eaf0; margin: 0 0 4px;
        }
        .auth-sub {
          font-size: 13px; color: #6b7491; margin: 0 0 20px;
        }
        .auth-tabs {
          display: flex;
          background: #0d0f14;
          border-radius: 10px;
          padding: 3px;
          margin-bottom: 20px;
          gap: 2px;
        }
        .auth-tab {
          flex: 1; padding: 8px;
          border: none; border-radius: 8px;
          font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all 0.2s;
          color: #6b7491; background: transparent;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        .auth-tab.active {
          background: #252a38; color: #e8eaf0;
        }
        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-field { display: flex; flex-direction: column; gap: 5px; }
        .auth-field label {
          font-size: 11px; font-weight: 600;
          color: #6b7491; letter-spacing: 0.08em;
          text-transform: uppercase;
          font-family: 'IBM Plex Mono', monospace;
        }
        .auth-field input {
          background: #1e2230;
          border: 1px solid #252a38;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px; color: #e8eaf0;
          outline: none; transition: border-color 0.15s;
          font-family: 'IBM Plex Mono', monospace;
          width: 100%; box-sizing: border-box;
        }
        .auth-field input:focus { border-color: rgba(168,197,160,0.5); }
        .auth-field input::placeholder { color: #3a4055; }
        .auth-error {
          font-size: 12px; color: #f7536b;
          background: rgba(247,83,107,0.1);
          border-radius: 6px; padding: 8px 12px;
          font-family: 'IBM Plex Mono', monospace;
          margin: 0;
        }
        .auth-btn {
          margin-top: 4px;
          padding: 12px;
          background: #f97325;
          color: #0d0f14;
          border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
          font-family: 'IBM Plex Sans', sans-serif;
          letter-spacing: 0.3px;
        }
        .auth-btn:hover { background: #f97325; }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-demo {
          text-align: center; margin-top: 16px;
          font-size: 12px; color: #6b7491;
        }
        .auth-demo-link {
          background: none; border: none; cursor: pointer;
          color: #f28648; font-size: 12px;
          font-family: 'IBM Plex Sans', sans-serif;
          font-weight: 600;
        }
        .auth-demo-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}


function AuthField({ label, children }) {
  return (
    <div className="auth-field">
      <label>{label}</label>
      {children}
    </div>
  )
}