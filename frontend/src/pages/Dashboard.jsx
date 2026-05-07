import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Zap, Target, BarChart2, Activity } from 'lucide-react'
import api from '../lib/api'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT']

const S = {
  bg:      '#0d0f14',
  surface: '#111318',
  s2:      '#161a24',
  border:  '#1e2230',
  border2: '#252a38',
  text:    '#e8eaf0',
  t2:      '#c8cfe0',
  muted:   '#6b7491',
  dim:     '#3a4055',
  green:   '#a8c5a0',
  red:     '#f7536b',
  yellow:  '#f7c948',
  blue:    '#7eb8f7',
}

function getPnlStyle(pnl, maxAbs) {
  if (pnl == null) return {}
  const intensity = Math.min(Math.abs(pnl) / (maxAbs || 1), 1)
  if (pnl > 0) return {
    background:  `rgba(168,197,160,${0.06 + intensity * 0.22})`,
    borderColor: `rgba(168,197,160,${0.08 + intensity * 0.28})`,
  }
  return {
    background:  `rgba(247,83,107,${0.06 + intensity * 0.22})`,
    borderColor: `rgba(247,83,107,${0.08 + intensity * 0.28})`,
  }
}

function ForgeRing({ score = 0 }) {
  const r = 34; const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const color = score >= 70 ? S.green : score >= 40 ? S.yellow : S.red
  return (
    <svg width={86} height={86} viewBox="0 0 86 86">
      <circle cx={43} cy={43} r={r} fill="none" stroke={S.border} strokeWidth={5} />
      <circle cx={43} cy={43} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" transform="rotate(-90 43 43)"
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x={43} y={48} textAnchor="middle" fill={color}
        fontSize={17} fontWeight={700} fontFamily="IBM Plex Mono,monospace">
        {Math.round(score)}
      </text>
    </svg>
  )
}

// Compute current streak
function getStreak(trades) {
  const sorted = [...trades]
    .filter(t => t.exit_price != null)
    .sort((a, b) => (b.entry_time || '').localeCompare(a.entry_time || ''))
  if (!sorted.length) return { count: 0, type: null }
  const first = (sorted[0].pnl ?? 0) > 0 ? 'win' : 'loss'
  let count = 0
  for (const t of sorted) {
    const isWin = (t.pnl ?? 0) > 0
    if ((first === 'win') === isWin) count++
    else break
  }
  return { count, type: first }
}

// Compute max drawdown
function getMaxDrawdown(trades) {
  const sorted = [...trades].sort((a, b) => (a.entry_time || '').localeCompare(b.entry_time || ''))
  let cum = 0, peak = 0, maxDD = 0
  for (const t of sorted) {
    cum += t.pnl ?? 0
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

const SETUP_LABELS = {
  fvg: 'FVG', ob: 'OB', breaker: 'Breaker', mss: 'MSS',
  displacement: 'Disp.', liquidity_sweep: 'Liq. Sweep',
  rejection_block: 'Rej. Block', sibi: 'SIBI', bisi: 'BISI',
}
const KZ_LABELS = {
  asia: 'Asia', london: 'London', ny_open: 'NY Open',
  ny_pm: 'NY PM', london_close: 'LDN Close',
}

export default function Dashboard() {
  const [data,    setData]    = useState(null)
  const [trades,  setTrades]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [selectedDay, setSelectedDay] = useState(null)

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/trades/'),
    ])
      .then(([d, t]) => { setData(d.data); setTrades(t.data) })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  // Calendar day map
  const dayMap = useMemo(() => {
    const map = {}
    trades.forEach(t => {
      const k = (t.entry_time || '').slice(0, 10)
      if (!k) return
      if (!map[k]) map[k] = { pnl: 0, count: 0, trades: [] }
      map[k].pnl   += t.pnl ?? 0
      map[k].count += 1
      map[k].trades.push(t)
    })
    return map
  }, [trades])

  const maxAbs = useMemo(() =>
    Math.max(...Object.values(dayMap).map(d => Math.abs(d.pnl)), 1),
    [dayMap]
  )

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = useMemo(() => {
    const c = []
    for (let i = 0; i < firstDay; i++) c.push(null)
    for (let d = 1; d <= daysInMonth; d++) c.push(d)
    return c
  }, [year, month, firstDay, daysInMonth])

  const todayStr = now.toISOString().slice(0, 10)

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  const summary      = data?.summary || {}
  const forgeScore   = data?.forge_score ?? null
  const closed       = trades.filter(t => t.exit_price != null)
  const wins         = closed.filter(t => (t.pnl ?? 0) > 0)
  const losses       = closed.filter(t => (t.pnl ?? 0) <= 0)
  const winRate      = closed.length ? (wins.length / closed.length * 100).toFixed(0) : 0
  const netPnl       = summary.net_pnl ?? trades.reduce((s, t) => s + (t.pnl ?? 0), 0)
  const totalTrades  = summary.total_trades ?? trades.length
  const avgRR        = summary.avg_rr != null ? summary.avg_rr.toFixed(1) : '—'
  const avgWin       = wins.length   ? wins.reduce((s,t)=>s+(t.pnl??0),0)   / wins.length   : 0
  const avgLoss      = losses.length ? Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0)) / losses.length : 0
  const streak       = useMemo(() => getStreak(trades), [trades])
  const maxDrawdown  = useMemo(() => getMaxDrawdown(trades), [trades])
  const profitFactor = summary.profit_factor ?? (() => {
    const gw = wins.reduce((s,t)=>s+(t.pnl??0),0)
    const gl = Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0))
    return gl > 0 ? gw / gl : 0
  })()

  const monthKey    = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthTrades = trades.filter(t => (t.entry_time || '').startsWith(monthKey))
  const monthPnl    = monthTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)

  const rawCurve = data?.cumulative_pnl || []
  const pnlCurve = rawCurve.length > 0
    ? rawCurve.map(p => ({ date: p.date, value: p.cumulative ?? p.value ?? 0 }))
    : (() => {
        let cum = 0
        return [...trades]
          .sort((a, b) => (a.entry_time || '').localeCompare(b.entry_time || ''))
          .map(t => { cum += t.pnl ?? 0; return { date: (t.entry_time || '').slice(0, 10), value: cum } })
      })()

  const selData  = selectedDay ? dayMap[selectedDay] : null
  const pieData  = [
    { name: 'Wins',   value: wins.length,   fill: S.green },
    { name: 'Losses', value: losses.length, fill: S.red },
  ]

  // Recent 5 closed trades
  const recentTrades = useMemo(() =>
    [...trades]
      .filter(t => t.exit_price != null)
      .sort((a, b) => (b.entry_time || '').localeCompare(a.entry_time || ''))
      .slice(0, 6),
    [trades]
  )

  const statCards = [
    {
      label: 'Net P&L', icon: TrendingUp,
      val: `${netPnl >= 0 ? '+' : ''}$${Math.abs(netPnl).toFixed(0)}`,
      color: netPnl >= 0 ? S.green : S.red,
      sub: `${totalTrades} total trades`,
    },
    {
      label: 'Win Rate', icon: Target,
      val: `${winRate}%`,
      color: S.blue,
      sub: `${wins.length}W · ${losses.length}L`,
    },
    {
      label: 'Profit Factor', icon: BarChart2,
      val: Number(profitFactor).toFixed(2),
      color: S.yellow,
      sub: `Avg win $${avgWin.toFixed(0)}`,
    },
    {
      label: 'Avg R:R', icon: Activity,
      val: avgRR,
      color: S.blue,
      sub: `Avg loss $${avgLoss.toFixed(0)}`,
    },
    {
      label: streak.type === 'win' ? 'Win Streak' : streak.type === 'loss' ? 'Loss Streak' : 'Streak',
      icon: streak.type === 'win' ? TrendingUp : TrendingDown,
      val: streak.count ? `${streak.count}${streak.type === 'win' ? '🔥' : ''}` : '—',
      color: streak.type === 'win' ? S.green : streak.type === 'loss' ? S.red : S.muted,
      sub: streak.type ? `${streak.type}s in a row` : 'no trades yet',
    },
    {
      label: 'Max Drawdown', icon: TrendingDown,
      val: maxDrawdown > 0 ? `-$${maxDrawdown.toFixed(0)}` : '$0',
      color: maxDrawdown > 0 ? S.red : S.muted,
      sub: 'peak-to-trough',
    },
  ]

  return (
    <div style={{ padding: '18px 20px', fontFamily: "'IBM Plex Sans', sans-serif", minHeight: '100%' }}>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: 'rgba(247,83,107,0.08)', border: `1px solid rgba(247,83,107,0.2)`, fontSize: 12, color: S.red, fontFamily: 'IBM Plex Mono' }}>
          {error}
        </div>
      )}

      {/* ── Stat cards row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
        {statCards.map(({ label, icon: Icon, val, color, sub }) => (
          <div key={label} style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 12, padding: '14px 15px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              <Icon size={13} color={S.dim} />
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'IBM Plex Mono,monospace', margin: 0, lineHeight: 1 }}>
              {loading ? '—' : val}
            </p>
            <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main 3-col grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 240px', gap: 10 }}>

        {/* Calendar */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: 0 }}>{MONTHS[month]} {year}</h2>
              <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: '2px 0 0' }}>
                {monthTrades.length} trades · <span style={{ color: monthPnl >= 0 ? S.green : S.red }}>{monthPnl >= 0 ? '+' : ''}${Math.abs(monthPnl).toFixed(0)}</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[{ icon: ChevronLeft, fn: prevMonth }, { icon: ChevronRight, fn: nextMonth }].map(({ icon: Icon, fn }, i) => (
                <button key={i} onClick={fn} style={{
                  width: 26, height: 26, borderRadius: 6, background: S.bg,
                  border: `1px solid ${S.border2}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: S.muted,
                }}>
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em', padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const d = dayMap[dateStr]
              const pnlStyle = d ? getPnlStyle(d.pnl, maxAbs) : {}
              const isToday  = dateStr === todayStr
              const isSel    = selectedDay === dateStr
              return (
                <div key={dateStr} onClick={() => setSelectedDay(isSel ? null : dateStr)}
                  style={{
                    aspectRatio: '1', borderRadius: 7,
                    background: pnlStyle.background || S.bg,
                    border: `1px solid ${isSel ? S.blue : (pnlStyle.borderColor || (isToday ? 'rgba(126,184,247,0.35)' : S.border))}`,
                    padding: '5px 6px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 0.12s',
                    boxShadow: isSel ? `0 0 0 1px rgba(126,184,247,0.2)` : 'none',
                  }}
                >
                  <span style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: isToday ? S.blue : S.muted, fontWeight: isToday ? 700 : 400 }}>{day}</span>
                  {d && (
                    <span style={{ fontSize: 9, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: d.pnl >= 0 ? S.green : S.red, lineHeight: 1 }}>
                      {d.pnl >= 0 ? '+' : ''}{Math.abs(d.pnl) >= 1000 ? `${(d.pnl / 1000).toFixed(1)}k` : d.pnl.toFixed(0)}
                    </span>
                  )}
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: d ? (d.pnl >= 0 ? S.green : S.red) : S.border, opacity: 0.7, alignSelf: 'flex-end' }} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Center panel: Forge score + Win rate donut + Month/RR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Forge Score */}
          {forgeScore != null && (
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 15px' }}>
              <p style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Forge Score</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ForgeRing score={forgeScore} />
                <div>
                  <p style={{ fontSize: 11, color: S.t2, fontFamily: 'IBM Plex Mono', margin: 0, fontWeight: 600 }}>
                    {forgeScore >= 70 ? 'Strong 💪' : forgeScore >= 40 ? 'Building' : 'Below target'}
                  </p>
                  <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: '3px 0 0' }}>composite</p>
                </div>
              </div>
            </div>
          )}

          {/* Win rate donut */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 15px' }}>
            <p style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Win Rate</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ResponsiveContainer width={72} height={72}>
                <PieChart>
                  <Pie
                    data={closed.length ? pieData : [{ name: 'None', value: 1, fill: S.border }]}
                    cx="50%" cy="50%" innerRadius={23} outerRadius={33}
                    paddingAngle={closed.length ? 3 : 0} dataKey="value" strokeWidth={0}
                  >
                    {(closed.length ? pieData : [{ fill: S.border }]).map((d, i) => (
                      <Cell key={i} fill={d.fill} fillOpacity={0.9} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700, color: S.yellow, fontFamily: 'IBM Plex Mono', margin: 0, lineHeight: 1 }}>{winRate}%</p>
                <p style={{ fontSize: 10, color: S.muted, margin: '4px 0 0', fontFamily: 'IBM Plex Mono' }}>{wins.length}W · {losses.length}L</p>
              </div>
            </div>
          </div>

          {/* Month P&L + Avg RR */}
          <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={{ fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>This Month</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: monthPnl >= 0 ? S.green : S.red, fontFamily: 'IBM Plex Mono', margin: 0 }}>
                  {monthPnl >= 0 ? '+' : ''}${Math.abs(monthPnl).toFixed(0)}
                </p>
                <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: '2px 0 0' }}>{monthTrades.length} trades</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>Avg R:R</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: S.blue, fontFamily: 'IBM Plex Mono', margin: 0 }}>{avgRR}</p>
                <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: '2px 0 0' }}>risk:reward</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: Selected day detail */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 15px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              {selData ? selectedDay : 'Day Detail'}
            </p>
            {selData && (
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: selData.pnl >= 0 ? S.green : S.red }}>
                {selData.pnl >= 0 ? '+' : ''}${selData.pnl.toFixed(2)}
              </span>
            )}
          </div>

          {!selData ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: S.bg, border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</div>
              <p style={{ fontSize: 11, color: S.dim, fontFamily: 'IBM Plex Mono', textAlign: 'center', margin: 0 }}>Tap a calendar day<br/>to inspect trades</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
              <p style={{ fontSize: 11, color: S.muted, fontFamily: 'IBM Plex Mono', margin: '0 0 4px' }}>
                {selData.count} trade{selData.count > 1 ? 's' : ''}
              </p>
              {selData.trades.map((t, i) => {
                const p = t.pnl ?? 0
                const dir = (t.direction || '').toLowerCase()
                return (
                  <div key={i} style={{
                    background: S.bg, borderRadius: 9, padding: '9px 11px',
                    border: `1px solid ${S.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: S.text, fontFamily: 'IBM Plex Mono' }}>{t.symbol}</span>
                        <span style={{
                          fontSize: 9, padding: '2px 5px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 700,
                          background: dir === 'long' ? 'rgba(168,197,160,0.12)' : 'rgba(247,83,107,0.12)',
                          color: dir === 'long' ? S.green : S.red,
                        }}>{dir.toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: p >= 0 ? S.green : S.red }}>
                        {p >= 0 ? '+' : ''}${p.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {t.setup && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(168,197,160,0.08)', color: S.green, fontFamily: 'IBM Plex Mono' }}>
                          {SETUP_LABELS[t.setup] || t.setup}
                        </span>
                      )}
                      {t.kill_zone && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(126,184,247,0.08)', color: S.blue, fontFamily: 'IBM Plex Mono' }}>
                          {KZ_LABELS[t.kill_zone] || t.kill_zone}
                        </span>
                      )}
                      {t.grade && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(247,201,72,0.08)', color: S.yellow, fontFamily: 'IBM Plex Mono' }}>
                          {t.grade.replace('_', '+').toUpperCase()}
                        </span>
                      )}
                      {t.r_multiple != null && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(247,201,72,0.06)', color: S.yellow, fontFamily: 'IBM Plex Mono' }}>
                          {t.r_multiple}R
                        </span>
                      )}
                    </div>
                    {t.notes && (
                      <p style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', margin: '5px 0 0', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>{t.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Cumulative P&L curve ── */}
      {pnlCurve.length > 1 && (
        <div style={{ marginTop: 10, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: S.text, margin: 0, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Equity Curve</h3>
            <span style={{ fontSize: 11, color: netPnl >= 0 ? S.green : S.red, fontFamily: 'IBM Plex Mono', fontWeight: 700 }}>
              {netPnl >= 0 ? '+' : ''}${Math.abs(netPnl).toFixed(2)} all time
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={pnlCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={S.green} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={S.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={S.border} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: S.dim, fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: S.dim, fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={52} />
              <Tooltip
                contentStyle={{ background: S.s2, border: `1px solid ${S.border2}`, borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                labelStyle={{ color: S.muted }}
                formatter={v => [`$${Number(v).toFixed(2)}`, 'Cum. P&L']}
              />
              <Area type="monotone" dataKey="value" stroke={S.green} strokeWidth={1.5} fill="url(#pnlGrad)" dot={false} activeDot={{ r: 4, fill: S.green, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent Trades strip ── */}
      {recentTrades.length > 0 && (
        <div style={{ marginTop: 10, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <p style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Recent Trades</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {recentTrades.map((t, i) => {
              const p   = t.pnl ?? 0
              const dir = (t.direction || '').toLowerCase()
              return (
                <div key={t.id || i} style={{
                  background: S.bg, border: `1px solid ${p >= 0 ? 'rgba(168,197,160,0.15)' : 'rgba(247,83,107,0.12)'}`,
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: S.text, fontFamily: 'IBM Plex Mono' }}>{t.symbol}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 700,
                      background: dir === 'long' ? 'rgba(168,197,160,0.1)' : 'rgba(247,83,107,0.1)',
                      color: dir === 'long' ? S.green : S.red,
                    }}>{dir === 'long' ? '▲' : '▼'}</span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: p >= 0 ? S.green : S.red, fontFamily: 'IBM Plex Mono', margin: '0 0 4px' }}>
                    {p >= 0 ? '+' : ''}${Math.abs(p).toFixed(2)}
                  </p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {t.setup && <span style={{ fontSize: 9, color: S.muted, fontFamily: 'IBM Plex Mono' }}>{SETUP_LABELS[t.setup] || t.setup}</span>}
                    {t.r_multiple != null && <span style={{ fontSize: 9, color: S.yellow, fontFamily: 'IBM Plex Mono' }}>{t.r_multiple}R</span>}
                  </div>
                  <p style={{ fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', margin: '4px 0 0' }}>
                    {t.entry_time ? new Date(t.entry_time).toLocaleDateString() : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}