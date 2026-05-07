import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, AreaChart, Area,
  PieChart, Pie, Legend,
} from 'recharts'
import api from '../lib/api'

// ── Shared tooltip ────────────────────────────────────────────
function ChartTip({ active, payload, label, prefix = '$' }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{ background: '#1e2230', border: '1px solid #252a38', borderRadius: 8, padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>
      {label && <p style={{ color: '#6b7491', margin: '0 0 4px' }}>{label}</p>}
      <p style={{ color: val >= 0 ? '#a8c5a0' : '#f7536b', margin: 0, fontWeight: 700 }}>
        {prefix}{Number(val).toFixed(2)}
      </p>
      {payload[1] && (
        <p style={{ color: '#7eb8f7', margin: '2px 0 0' }}>
          {payload[1].name}: {Number(payload[1].value).toFixed(0)}%
        </p>
      )}
    </div>
  )
}

function NoData({ height = 180 }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: '#3a4055', fontFamily: 'IBM Plex Mono' }}>No data yet</p>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', margin: '0 0 14px', fontFamily: 'IBM Plex Mono' }}>
      {children}
    </h3>
  )
}

// ── Horizontal bar with label ──────────────────────────────────
function HBar({ label, pnl, winRate, max, wins, losses }) {
  const pct = max > 0 ? (Math.abs(pnl) / max) * 100 : 0
  const pos = pnl >= 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: '#c8cfe0', fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          {winRate != null && (
            <span style={{ fontSize: 10, color: '#f7c948', fontFamily: 'IBM Plex Mono' }}>
              {winRate.toFixed(0)}% WR
            </span>
          )}
          {(wins != null || losses != null) && (
            <span style={{ fontSize: 10, color: '#3a4055', fontFamily: 'IBM Plex Mono' }}>
              {wins}W / {losses}L
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: pos ? '#a8c5a0' : '#f7536b' }}>
            {pos ? '+' : ''}${pnl.toFixed(0)}
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: '#1e2230', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pos ? '#a8c5a0' : '#f7536b',
          borderRadius: 4, opacity: 0.75,
          transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  )
}

export default function Reports() {
  const [trades,     setTrades]     = useState([])
  const [killZones,  setKillZones]  = useState([])
  const [setups,     setSetups]     = useState([])
  const [pnlCurve,   setPnlCurve]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/trades/'),
      api.get('/analytics/by-killzone'),
      api.get('/analytics/by-setup'),
      api.get('/analytics/pnl-curve'),
    ])
      .then(([t, kz, st, curve]) => {
        setTrades(t.data)
        // Normalise kill zone data — handle array or object shapes
        const kzRaw = kz.data
        if (Array.isArray(kzRaw)) {
          setKillZones(kzRaw)
        } else if (kzRaw && typeof kzRaw === 'object') {
          setKillZones(
            Object.entries(kzRaw).map(([name, v]) =>
              typeof v === 'object' ? { name, ...v } : { name, pnl: v }
            )
          )
        }
        // Normalise setup data
        const stRaw = st.data
        if (Array.isArray(stRaw)) {
          setSetups(stRaw)
        } else if (stRaw && typeof stRaw === 'object') {
          setSetups(
            Object.entries(stRaw).map(([name, v]) =>
              typeof v === 'object' ? { name, ...v } : { name, pnl: v }
            )
          )
        }
        // P&L curve
        const curveRaw = curve.data
        if (Array.isArray(curveRaw)) {
          setPnlCurve(curveRaw)
        }
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  // ── Client-side aggregates from /trades/ ─────────────────
  const closed  = trades.filter(t => t.exit_price != null)
  const wins    = closed.filter(t => (t.pnl ?? t.net_pnl ?? 0) > 0)
  const losses  = closed.filter(t => (t.pnl ?? t.net_pnl ?? 0) <= 0)

  const netPnl      = closed.reduce((s, t) => s + (t.pnl ?? t.net_pnl ?? 0), 0)
  const winRate     = closed.length ? (wins.length / closed.length * 100).toFixed(0) : 0
  const grossWin    = wins.reduce((s, t) => s + (t.pnl ?? t.net_pnl ?? 0), 0)
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? t.net_pnl ?? 0), 0))
  const pf          = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '—'
  const avgWin      = wins.length   ? (grossWin  / wins.length).toFixed(2)   : '0.00'
  const avgLoss     = losses.length ? (grossLoss / losses.length).toFixed(2) : '0.00'

  // P&L by symbol (client-side, no endpoint for this)
  const bySymbol = {}
  closed.forEach(t => {
    const sym = t.symbol || t.pair || 'Unknown'
    bySymbol[sym] = (bySymbol[sym] || 0) + (t.pnl ?? t.net_pnl ?? 0)
  })
  const symbolData = Object.entries(bySymbol)
    .map(([symbol, pnl]) => ({ symbol, pnl: parseFloat(pnl.toFixed(2)) }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 8)

  // Win/Loss pie
  const pieData = [
    { name: 'Wins',   value: wins.length,   fill: '#a8c5a0' },
    { name: 'Losses', value: losses.length, fill: '#f7536b' },
  ]

  // Precompute max for HBars
  const kzMax = Math.max(...killZones.map(k => Math.abs(k.pnl ?? k.net_pnl ?? 0)), 1)
  const stMax = Math.max(...setups.map(s => Math.abs(s.pnl ?? s.net_pnl ?? 0)), 1)

  const TopCard = ({ label, val, color }) => (
    <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: '18px 20px' }}>
      <p style={{ fontSize: 28, fontWeight: 700, color, fontFamily: 'IBM Plex Mono', margin: '0 0 4px' }}>
        {loading ? '—' : val}
      </p>
      <p style={{ fontSize: 10, color: '#6b7491', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'IBM Plex Mono', margin: 0 }}>{label}</p>
    </div>
  )

  return (
    <div style={{ padding: 20, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8eaf0', margin: '0 0 18px' }}>Performance Reports</h1>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: 'rgba(247,83,107,0.08)', border: '1px solid rgba(247,83,107,0.2)', fontSize: 12, color: '#f7536b', fontFamily: 'IBM Plex Mono' }}>
          {error}
        </div>
      )}

      {/* ── KPI grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <TopCard label="Total Net P&L"  val={`${netPnl>=0?'+':''}$${Math.abs(netPnl).toFixed(0)}`} color={netPnl>=0?'#a8c5a0':'#f7536b'} />
        <TopCard label="Win Rate"       val={`${winRate}%`}  color="#f7c948" />
        <TopCard label="Profit Factor"  val={pf}             color="#7eb8f7" />
        <TopCard label="Avg Win"        val={`$${avgWin}`}   color="#a8c5a0" />
        <TopCard label="Avg Loss"       val={`$${avgLoss}`}  color="#f7536b" />
        <TopCard label="Total Trades"   val={closed.length}  color="#c8cfe0" />
      </div>

      {/* ── P&L Curve (full width) ── */}
      {pnlCurve.length > 1 && (
        <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: 18, marginBottom: 12 }}>
          <SectionTitle>Equity Curve</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pnlCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a8c5a0" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a8c5a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e2230" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#3a4055', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#3a4055', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={52} />
              <Tooltip
                contentStyle={{ background: '#1e2230', border: '1px solid #252a38', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                labelStyle={{ color: '#6b7491' }}
                formatter={v => [`$${Number(v).toFixed(2)}`, 'Cum. P&L']}
              />
              <Area type="monotone" dataKey="value" stroke="#a8c5a0" strokeWidth={2} fill="url(#reportGrad)" dot={false} activeDot={{ r: 4, fill: '#a8c5a0', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>

        {/* Kill Zone breakdown (from /analytics/by-killzone) */}
        <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: 18 }}>
          <SectionTitle>P&L by Kill Zone</SectionTitle>
          {loading ? <NoData /> : killZones.length === 0 ? <NoData /> : (
            <div>
              {killZones
                .map(k => ({ ...k, pnl: k.pnl ?? k.net_pnl ?? 0 }))
                .sort((a, b) => b.pnl - a.pnl)
                .map((k, i) => (
                  <HBar
                    key={i}
                    label={k.name || k.kill_zone || k.session || 'Unknown'}
                    pnl={k.pnl}
                    winRate={k.win_rate != null ? k.win_rate * 100 : null}
                    wins={k.wins ?? k.win_count ?? null}
                    losses={k.losses ?? k.loss_count ?? null}
                    max={kzMax}
                  />
                ))
              }
            </div>
          )}
        </div>

        {/* Setup breakdown (from /analytics/by-setup) */}
        <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: 18 }}>
          <SectionTitle>P&L by Setup</SectionTitle>
          {loading ? <NoData /> : setups.length === 0 ? <NoData /> : (
            <div>
              {setups
                .map(s => ({ ...s, pnl: s.pnl ?? s.net_pnl ?? 0 }))
                .sort((a, b) => b.pnl - a.pnl)
                .map((s, i) => (
                  <HBar
                    key={i}
                    label={s.name || s.setup_type || s.setup || 'Unknown'}
                    pnl={s.pnl}
                    winRate={s.win_rate != null ? s.win_rate * 100 : null}
                    wins={s.wins ?? s.win_count ?? null}
                    losses={s.losses ?? s.loss_count ?? null}
                    max={stMax}
                  />
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row: Symbol bars + Win/Loss donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>

        {/* P&L by symbol */}
        <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: 18 }}>
          <SectionTitle>P&L by Symbol</SectionTitle>
          {symbolData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={symbolData} layout="vertical" barSize={10} margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#1e2230" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#3a4055', fontSize: 10, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <YAxis dataKey="symbol" type="category" tick={{ fill: '#c8cfe0', fontSize: 11, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                  {symbolData.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? '#a8c5a0' : '#f7536b'} fillOpacity={0.8} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <NoData height={220} />}
        </div>

        {/* Win / Loss distribution */}
        <div style={{ background: '#111318', border: '1px solid #1e2230', borderRadius: 14, padding: 18 }}>
          <SectionTitle>Win / Loss Distribution</SectionTitle>
          {closed.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e2230', border: '1px solid #252a38', borderRadius: 8, fontFamily: 'IBM Plex Mono', fontSize: 12 }}
                    formatter={(v, n) => [v, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill }} />
                    <span style={{ fontSize: 11, color: '#6b7491', fontFamily: 'IBM Plex Mono' }}>{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
              {/* Streaks */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e2230', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Best Win',  val: `$${Math.max(...wins.map(t => t.pnl??t.net_pnl??0), 0).toFixed(0)}`,  color: '#a8c5a0' },
                  { label: 'Worst Loss', val: `-$${Math.abs(Math.min(...losses.map(t => t.pnl??t.net_pnl??0), 0)).toFixed(0)}`, color: '#f7536b' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: 9, color: '#3a4055', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>{label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'IBM Plex Mono', margin: 0 }}>{val}</p>
                  </div>
                ))}
              </div>
            </>
          ) : <NoData height={220} />}
        </div>
      </div>
    </div>
  )
}