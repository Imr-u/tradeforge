import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import {
  BarChart, Bar, ResponsiveContainer, Cell, XAxis, YAxis, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import clsx from 'clsx'

const TOP_NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/journal',   label: 'Journal' },
  { to: '/notebook',  label: 'Notebook', soon: true },
  { to: '/reports',   label: 'Reports' },
]

export default function Layout() {
  const logout   = useAuthStore(s => s.logout)
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const [sidebar, setSidebar] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/analytics/dashboard'), api.get('/trades/')])
      .then(([d, t]) => {
        const stats  = d.data?.summary || {}
        const trades = t.data || []

        // Daily P&L — last 14 days
        const byDate = {}
        trades.forEach(tr => {
          const dt = (tr.trade_date || '').slice(0, 10)
          if (dt) byDate[dt] = (byDate[dt] || 0) + (tr.pnl ?? tr.net_pnl ?? 0)
        })
        const daily = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-14)
          .map(([date, pnl]) => ({ date: date.slice(8), pnl: parseFloat(pnl.toFixed(2)) }))

        // Monthly P&L — last 6 months
        const byMonth = {}
        trades.forEach(tr => {
          const mo = (tr.trade_date || '').slice(0, 7)
          if (mo) byMonth[mo] = (byMonth[mo] || 0) + (tr.pnl ?? tr.net_pnl ?? 0)
        })
        const monthly = Object.entries(byMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6)
          .map(([mo, pnl]) => ({
            label: new Date(mo + '-01').toLocaleString('default', { month: 'short' }),
            pnl: parseFloat(pnl.toFixed(2))
          }))

        // Radar data
        const wr = stats.win_rate || 0
        const pf = Math.min((stats.profit_factor || 0) / 3, 1)
        const rr = Math.min((stats.avg_rr || 0) / 3, 1)
        const radar = [
          { axis: 'Profit',  val: Math.min(Math.max((stats.net_pnl || 0) / 1000, 0), 1) * 100 },
          { axis: 'Risk',    val: rr * 100 },
          { axis: 'Cons.',   val: pf * 100 },
          { axis: 'Streak',  val: 50 },
          { axis: 'Disc.',   val: 50 },
          { axis: 'W.Rate',  val: wr * 100 },
        ]

        setSidebar({
          netPnl:   stats.net_pnl ?? 0,
          winRate:  stats.win_rate ?? 0,
          profFactor: stats.profit_factor ?? 0,
          trades:   stats.total_trades ?? trades.length ?? 0,
          daily, monthly, radar
        })
      })
      .catch(() => setSidebar({}))
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  const s = sidebar || {}
  const pnlPos = (s.netPnl || 0) >= 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0d0f14', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Left Sidebar ── */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#111318',
        borderRight: '1px solid #1e2230',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '20px 0'
      }}>
        {/* Overview */}
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: '#3a4055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Net P&L',     val: `${pnlPos?'+':''}$${Math.abs(s.netPnl||0).toFixed(0)}`, color: pnlPos ? '#a8c5a0' : '#f7536b' },
              { label: 'Win Rate',    val: `${((s.winRate||0)*100).toFixed(0)}%`,  color: '#f7c948' },
              { label: 'Prof. Factor',val: (s.profFactor||0).toFixed(2),           color: '#7eb8f7' },
              { label: 'Trades',      val: s.trades || 0,                           color: '#c8cfe0' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{
                background: '#0d0f14', border: '1px solid #1e2230',
                borderRadius: 8, padding: '8px 10px'
              }}>
                <p style={{ fontSize: 16, fontWeight: 700, color, fontFamily: "'IBM Plex Mono',monospace", margin: 0 }}>{val}</p>
                <p style={{ fontSize: 9, color: '#3a4055', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 0 0', fontFamily: "'IBM Plex Mono',monospace" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Radar */}
        <div style={{ padding: '0 16px', marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: '#3a4055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Performance Radar</p>
          <div style={{ background: '#0d0f14', border: '1px solid #1e2230', borderRadius: 10, padding: '8px 0' }}>
            <ResponsiveContainer width="100%" height={130}>
              <RadarChart data={s.radar || []}>
                <PolarGrid stroke="#1e2230" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#6b7491', fontSize: 9, fontFamily: 'IBM Plex Mono' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="val" stroke="#a8c5a0" fill="#a8c5a0" fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 2, fill: '#a8c5a0' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Net P&L */}
        <div style={{ padding: '0 16px', marginBottom: 12 }}>
          <p style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: '#3a4055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Daily Net P&L</p>
          <div style={{ background: '#0d0f14', border: '1px solid #1e2230', borderRadius: 10, padding: '8px 4px' }}>
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={s.daily || []} barSize={6} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {(s.daily || []).map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? '#a8c5a0' : '#f7536b'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly P&L */}
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: 9, fontFamily: "'IBM Plex Mono',monospace", color: '#3a4055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Monthly P&L</p>
          <div style={{ background: '#0d0f14', border: '1px solid #1e2230', borderRadius: 10, padding: '8px 4px' }}>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={s.monthly || []} barSize={12} margin={{ top: 2, right: 4, left: 0, bottom: 12 }}>
                <XAxis dataKey="label" tick={{ fill: '#3a4055', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {(s.monthly || []).map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? '#a8c5a0' : '#f7536b'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </aside>

      {/* ── Right side ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top nav */}
        <header style={{
          height: 52, flexShrink: 0,
          background: '#111318',
          borderBottom: '1px solid #1e2230',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 4
        }}>
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {TOP_NAV.map(({ to, label, soon }) => (
              <NavLink
                key={to}
                to={soon ? '#' : to}
                onClick={e => soon && e.preventDefault()}
                style={({ isActive }) => ({
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13, fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  background: isActive && !soon ? '#252a38' : 'transparent',
                  color: isActive && !soon ? '#e8eaf0' : '#6b7491',
                  border: isActive && !soon ? '1px solid #2e3448' : '1px solid transparent',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                })}
              >
                {label}
                {soon && <span style={{ fontSize: 9, marginLeft: 5, color: '#3a4055', fontFamily: 'IBM Plex Mono' }}>SOON</span>}
              </NavLink>
            ))}
          </nav>

          {/* User + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#252a38', border: '1px solid #2e3448',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#e8eaf0'
            }}>
              {(user?.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, color: '#c8cfe0', fontWeight: 500 }}>
              {user?.email?.split('@')[0] || 'User'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: '#1e2230', border: '1px solid #252a38',
                color: '#6b7491', fontSize: 12, cursor: 'pointer',
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.color = '#f7536b'; e.target.style.borderColor = 'rgba(247,83,107,0.3)' }}
              onMouseLeave={e => { e.target.style.color = '#6b7491'; e.target.style.borderColor = '#252a38' }}
            >
              Log out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}