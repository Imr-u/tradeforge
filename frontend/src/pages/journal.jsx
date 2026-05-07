import { useEffect, useState, useMemo } from 'react'
import { LayoutGrid, List, Download, Plus, X, Edit2, Trash2 } from 'lucide-react'
import api from '../lib/api'

const KILL_ZONES = [
  { value: 'asia',         label: 'Asia' },
  { value: 'london',       label: 'London' },
  { value: 'ny_open',      label: 'NY Open' },
  { value: 'ny_pm',        label: 'NY PM' },
  { value: 'london_close', label: 'London Close' },
]
const SETUPS = [
  { value: 'fvg',             label: 'FVG' },
  { value: 'ob',              label: 'Order Block' },
  { value: 'breaker',         label: 'Breaker' },
  { value: 'mss',             label: 'MSS' },
  { value: 'displacement',    label: 'Displacement' },
  { value: 'liquidity_sweep', label: 'Liquidity Sweep' },
  { value: 'rejection_block', label: 'Rejection Block' },
  { value: 'sibi',            label: 'SIBI' },
  { value: 'bisi',            label: 'BISI' },
]
const EMOTIONS = [
  { value: 'calm',      label: 'Calm' },
  { value: 'confident', label: 'Confident' },
  { value: 'fomo',      label: 'FOMO' },
  { value: 'fear',      label: 'Fear' },
  { value: 'revenge',   label: 'Revenge' },
]
const GRADES = [
  { value: 'a_plus', label: 'A+' },
  { value: 'a',      label: 'A'  },
  { value: 'b',      label: 'B'  },
  { value: 'c',      label: 'C'  },
]

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

const defaultEntryTime = () => {
  const now = new Date()
  return `${now.toISOString().slice(0, 10)}T09:30`
}

const EMPTY = {
  symbol: '', direction: 'long', entry: '', exit: '',
  sl: '', tp: '', contracts: '1', kill_zone: '', setup: '',
  emotion: '', grade: '', entry_time: defaultEntryTime(),
  exit_time: '', notes: '', account_id: '',
}

// ── CSV Export ──────────────────────────────────────────────
function exportCSV(trades) {
  const headers = ['Date', 'Symbol', 'Direction', 'Entry', 'Exit', 'Contracts', 'SL', 'TP', 'P&L', 'R', 'Kill Zone', 'Setup', 'Emotion', 'Grade', 'Notes']
  const kzLabel = v => KILL_ZONES.find(k => k.value === v)?.label || v || ''
  const stLabel = v => SETUPS.find(s => s.value === v)?.label || v || ''
  const rows = trades.map(t => [
    t.entry_time ? new Date(t.entry_time).toLocaleDateString() : '',
    t.symbol || '',
    t.direction || '',
    t.entry ?? '',
    t.exit ?? '',
    t.contracts ?? '',
    t.sl ?? '',
    t.tp ?? '',
    t.pnl != null ? t.pnl.toFixed(2) : '',
    t.r_multiple ?? '',
    kzLabel(t.kill_zone),
    stLabel(t.setup),
    t.emotion || '',
    t.grade || '',
    (t.notes || '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `tradeforge_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Account modal ───────────────────────────────────────────
function AccountModal({ onClose, onCreated }) {
  const [form,   setForm]   = useState({ name: '', broker: '', currency: 'USD', balance: '' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function handleCreate(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const res = await api.post('/accounts/', {
        name: form.name, broker: form.broker || null,
        currency: form.currency || 'USD', balance: parseFloat(form.balance) || 0,
      })
      onCreated(res.data)
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Failed to create account')
    } finally { setSaving(false) }
  }

  return (
    <Overlay onClick={onClose}>
      <ModalCard width={380}>
        <ModalHeader title="New Account" onClose={onClose} />
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <JField label="Account Name">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Main Account, Prop Firm…" style={inputStyle} />
          </JField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <JField label="Broker">
              <input value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))}
                placeholder="FTMO, IC Markets…" style={inputStyle} />
            </JField>
            <JField label="Currency">
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                {['USD','EUR','GBP','ETB'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </JField>
          </div>
          <JField label="Starting Balance">
            <input type="number" step="any" value={form.balance}
              onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="10000" style={inputStyle} />
          </JField>
          {error && <ErrBox>{error}</ErrBox>}
          <PrimaryBtn type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Account'}</PrimaryBtn>
        </form>
      </ModalCard>
    </Overlay>
  )
}

// ── Edit modal — with structured note tabs ──────────────────
function EditModal({ trade, onClose, onSaved }) {
  const toLocalDT = iso => iso ? new Date(iso).toISOString().slice(0, 16) : ''

  // Parse notes: support plain string or JSON {pre, during, reflection}
  const parseNotes = raw => {
    try {
      const parsed = JSON.parse(raw || '{}')
      if (typeof parsed === 'object' && parsed !== null) {
        return { pre: parsed.pre || '', during: parsed.during || '', reflection: parsed.reflection || '' }
      }
    } catch {}
    return { pre: raw || '', during: '', reflection: '' }
  }

  const initialNotes = parseNotes(trade.notes)
  const [form,      setForm]      = useState({
    symbol:     trade.symbol || '',
    direction:  trade.direction || 'long',
    entry:      trade.entry ?? '',
    exit:       trade.exit ?? '',
    sl:         trade.sl ?? '',
    tp:         trade.tp ?? '',
    contracts:  trade.contracts ?? 1,
    kill_zone:  trade.kill_zone || '',
    setup:      trade.setup || '',
    emotion:    trade.emotion || '',
    grade:      trade.grade || '',
    entry_time: toLocalDT(trade.entry_time),
    exit_time:  toLocalDT(trade.exit_time),
  })
  const [notes,   setNotes]   = useState(initialNotes)
  const [noteTab, setNoteTab] = useState('pre')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  function field(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSaving(true)
    // Serialize notes as JSON if any structured notes exist
    const hasStructured = notes.during || notes.reflection
    const notesStr = hasStructured
      ? JSON.stringify({ pre: notes.pre, during: notes.during, reflection: notes.reflection })
      : notes.pre

    try {
      const payload = {
        symbol:     form.symbol.toUpperCase(),
        direction:  form.direction,
        entry:      parseFloat(form.entry),
        contracts:  parseFloat(form.contracts) || 1,
        entry_time: new Date(form.entry_time).toISOString(),
        ...(form.exit      ? { exit:      parseFloat(form.exit) }      : { exit: null }),
        ...(form.sl        ? { sl:        parseFloat(form.sl) }        : { sl: null }),
        ...(form.tp        ? { tp:        parseFloat(form.tp) }        : {}),
        ...(form.kill_zone ? { kill_zone: form.kill_zone }             : { kill_zone: null }),
        ...(form.setup     ? { setup:     form.setup }                 : { setup: null }),
        ...(form.emotion   ? { emotion:   form.emotion }               : { emotion: null }),
        ...(form.grade     ? { grade:     form.grade }                 : { grade: null }),
        ...(form.exit_time ? { exit_time: new Date(form.exit_time).toISOString() } : { exit_time: null }),
        notes: notesStr || null,
      }
      const res = await api.put(`/trades/${trade.id}`, payload)
      onSaved(res.data)
    } catch (err) {
      const d = err.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Failed to save changes')
    } finally { setSaving(false) }
  }

  const noteTabs = [
    { key: 'pre',        label: 'Pre-Market',  placeholder: 'Bias, key levels, what to watch for…' },
    { key: 'during',     label: 'During',      placeholder: 'How the trade played out, adjustments…' },
    { key: 'reflection', label: 'Reflection',  placeholder: 'What went well, what to improve, lessons…' },
  ]

  return (
    <Overlay onClick={onClose}>
      <ModalCard width={540}>
        <ModalHeader title="Edit Trade" onClose={onClose} />
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <JField label="Symbol">
              <input value={form.symbol} required onChange={e => field('symbol', e.target.value.toUpperCase())} style={inputStyle} />
            </JField>
            <JField label="Entry Time">
              <input type="datetime-local" value={form.entry_time} required onChange={e => field('entry_time', e.target.value)} style={inputStyle} />
            </JField>
          </div>

          <JField label="Direction">
            <DirToggle value={form.direction} onChange={v => field('direction', v)} />
          </JField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <JField label="Entry">  <input type="number" step="any" value={form.entry}     required onChange={e => field('entry', e.target.value)}     style={inputStyle} /></JField>
            <JField label="Exit">   <input type="number" step="any" value={form.exit}              onChange={e => field('exit', e.target.value)}      style={inputStyle} /></JField>
            <JField label="Contracts"><input type="number" step="any" value={form.contracts}        onChange={e => field('contracts', e.target.value)} style={inputStyle} /></JField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <JField label="Stop Loss">  <input type="number" step="any" value={form.sl} onChange={e => field('sl', e.target.value)} style={inputStyle} /></JField>
            <JField label="Take Profit"><input type="number" step="any" value={form.tp} onChange={e => field('tp', e.target.value)} style={inputStyle} /></JField>
          </div>

          <JField label="Kill Zone">
            <ChipGroup options={KILL_ZONES} value={form.kill_zone} onChange={v => field('kill_zone', v)} color={S.blue} />
          </JField>

          <JField label="Setup">
            <ChipGroup options={SETUPS} value={form.setup} onChange={v => field('setup', v)} color={S.green} />
          </JField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <JField label="Emotion">
              <select value={form.emotion} onChange={e => field('emotion', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— Select —</option>
                {EMOTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </JField>
            <JField label="Grade">
              <ChipGroup options={GRADES} value={form.grade} onChange={v => field('grade', v)} color={S.yellow} />
            </JField>
          </div>

          <JField label="Exit Time">
            <input type="datetime-local" value={form.exit_time} onChange={e => field('exit_time', e.target.value)} style={inputStyle} />
          </JField>

          {/* ── Structured Notes ── */}
          <JField label="Notes">
            <div style={{ background: S.bg, border: `1px solid ${S.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, padding: '0 4px' }}>
                {noteTabs.map(({ key, label }) => (
                  <button key={key} type="button" onClick={() => setNoteTab(key)} style={{
                    padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, fontFamily: 'IBM Plex Mono',
                    color: noteTab === key ? S.text : S.muted,
                    borderBottom: noteTab === key ? `2px solid ${S.green}` : '2px solid transparent',
                    marginBottom: -1, transition: 'color 0.15s',
                  }}>
                    {label}
                    {notes[key] && <span style={{ marginLeft: 4, width: 5, height: 5, borderRadius: '50%', background: S.green, display: 'inline-block', verticalAlign: 'middle' }} />}
                  </button>
                ))}
              </div>
              {/* Active tab content */}
              {noteTabs.map(({ key, placeholder }) => noteTab === key && (
                <textarea key={key} value={notes[key]}
                  onChange={e => setNotes(n => ({ ...n, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    ...inputStyle, border: 'none', borderRadius: 0, background: 'transparent',
                    minHeight: 80, resize: 'vertical', width: '100%',
                  }} />
              ))}
            </div>
          </JField>

          {error && <ErrBox>{error}</ErrBox>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '11px', background: S.border, color: S.muted,
              border: `1px solid ${S.border2}`, borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'IBM Plex Sans', sans-serif",
            }}>Cancel</button>
            <PrimaryBtn type="submit" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </PrimaryBtn>
          </div>
        </form>
      </ModalCard>
    </Overlay>
  )
}

// ── Trade Gallery Card ──────────────────────────────────────
function TradeCard({ trade, onEdit, onDelete, deleting }) {
  const p   = trade.pnl ?? 0
  const pos = p >= 0
  const dir = (trade.direction || '').toLowerCase()
  const kzLabel    = KILL_ZONES.find(k => k.value === trade.kill_zone)?.label  || null
  const setupLabel = SETUPS.find(s => s.value === trade.setup)?.label           || null
  const gradeLabel = GRADES.find(g => g.value === trade.grade)?.label           || null

  // Show notes preview (handle JSON structured notes)
  let notesPreview = ''
  try {
    const parsed = JSON.parse(trade.notes || '{}')
    if (typeof parsed === 'object' && parsed !== null) {
      notesPreview = parsed.pre || parsed.during || parsed.reflection || ''
    } else { notesPreview = trade.notes || '' }
  } catch { notesPreview = trade.notes || '' }

  return (
    <div style={{
      background: S.surface,
      border: `1px solid ${pos ? 'rgba(168,197,160,0.18)' : 'rgba(247,83,107,0.15)'}`,
      borderRadius: 12,
      padding: '14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.15s, transform 0.15s',
      position: 'relative',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.4)` }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text, fontFamily: 'IBM Plex Mono' }}>{trade.symbol}</span>
          <span style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 700,
            background: dir === 'long' ? 'rgba(168,197,160,0.12)' : 'rgba(247,83,107,0.12)',
            color: dir === 'long' ? S.green : S.red,
          }}>{dir === 'long' ? '▲ LONG' : '▼ SHORT'}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn onClick={() => onEdit(trade)} title="Edit">
            <Edit2 size={12} />
          </IconBtn>
          <IconBtn onClick={() => onDelete(trade.id)} disabled={deleting} danger title="Delete">
            <Trash2 size={12} />
          </IconBtn>
        </div>
      </div>

      {/* P&L */}
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: pos ? S.green : S.red, fontFamily: 'IBM Plex Mono', margin: 0, lineHeight: 1 }}>
          {pos ? '+' : ''}${Math.abs(p).toFixed(2)}
        </p>
        {trade.r_multiple != null && (
          <p style={{ fontSize: 11, color: S.yellow, fontFamily: 'IBM Plex Mono', margin: '3px 0 0' }}>{trade.r_multiple}R</p>
        )}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {kzLabel && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(126,184,247,0.1)', color: S.blue, fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
            {kzLabel}
          </span>
        )}
        {setupLabel && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(168,197,160,0.1)', color: S.green, fontFamily: 'IBM Plex Mono', fontWeight: 600 }}>
            {setupLabel}
          </span>
        )}
        {trade.emotion && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(126,184,247,0.06)', color: S.muted, fontFamily: 'IBM Plex Mono' }}>
            {trade.emotion}
          </span>
        )}
        {gradeLabel && (
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(247,201,72,0.1)', color: S.yellow, fontFamily: 'IBM Plex Mono', fontWeight: 700 }}>
            {gradeLabel}
          </span>
        )}
      </div>

      {/* Entry/Exit prices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ background: S.bg, borderRadius: 7, padding: '6px 9px' }}>
          <p style={{ fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Entry</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: S.t2, fontFamily: 'IBM Plex Mono', margin: 0 }}>{trade.entry ?? '—'}</p>
        </div>
        <div style={{ background: S.bg, borderRadius: 7, padding: '6px 9px' }}>
          <p style={{ fontSize: 9, color: S.dim, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>Exit</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: S.t2, fontFamily: 'IBM Plex Mono', margin: 0 }}>{trade.exit ?? '—'}</p>
        </div>
      </div>

      {/* Notes preview */}
      {notesPreview && (
        <p style={{
          fontSize: 11, color: S.muted, fontFamily: 'IBM Plex Mono', margin: 0,
          lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          borderTop: `1px solid ${S.border}`, paddingTop: 8,
        }}>
          {notesPreview}
        </p>
      )}

      {/* Date */}
      <p style={{ fontSize: 10, color: S.dim, fontFamily: 'IBM Plex Mono', margin: 0 }}>
        {trade.entry_time ? new Date(trade.entry_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </p>
    </div>
  )
}

// ── Main Journal page ───────────────────────────────────────
export default function Journal() {
  const [form,       setForm]       = useState(EMPTY)
  const [trades,     setTrades]     = useState([])
  const [accounts,   setAccounts]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [filter,     setFilter]     = useState('')
  const [dirFilter,  setDirFilter]  = useState('all')
  const [editTrade,  setEditTrade]  = useState(null)
  const [deleting,   setDeleting]   = useState(null)
  const [showAccMod, setShowAccMod] = useState(false)
  const [viewMode,   setViewMode]   = useState('gallery') // 'gallery' | 'table'

  useEffect(() => {
    Promise.all([api.get('/trades/'), api.get('/accounts/')])
      .then(([t, a]) => {
        setTrades(t.data)
        setAccounts(a.data)
        if (a.data.length > 0) setForm(f => ({ ...f, account_id: a.data[0].id }))
      })
      .finally(() => setLoading(false))
  }, [])

  function field(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const payload = {
        account_id: parseInt(form.account_id),
        symbol:     form.symbol.toUpperCase(),
        direction:  form.direction,
        entry:      parseFloat(form.entry),
        contracts:  parseFloat(form.contracts) || 1,
        entry_time: new Date(form.entry_time).toISOString(),
        ...(form.exit      ? { exit:      parseFloat(form.exit) }      : {}),
        ...(form.sl        ? { sl:        parseFloat(form.sl) }        : {}),
        ...(form.tp        ? { tp:        parseFloat(form.tp) }        : {}),
        ...(form.kill_zone ? { kill_zone: form.kill_zone }             : {}),
        ...(form.setup     ? { setup:     form.setup }                 : {}),
        ...(form.emotion   ? { emotion:   form.emotion }               : {}),
        ...(form.grade     ? { grade:     form.grade }                 : {}),
        ...(form.exit_time ? { exit_time: new Date(form.exit_time).toISOString() } : {}),
        ...(form.notes     ? { notes:     form.notes }                 : {}),
      }
      const res = await api.post('/trades/', payload)
      setTrades(prev => [res.data, ...prev])
      setForm(f => ({ ...EMPTY, account_id: f.account_id, entry_time: f.entry_time }))
    } catch (err) {
      const d = err.response?.data?.detail
      if (Array.isArray(d)) setError(d.map(e => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(' · '))
      else setError(typeof d === 'string' ? d : 'Failed to log trade')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await api.delete(`/trades/${id}`)
      setTrades(prev => prev.filter(t => t.id !== id))
    } catch {} finally { setDeleting(null) }
  }

  function handleSaved(updated) {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditTrade(null)
  }

  function handleAccountCreated(account) {
    setAccounts(prev => [...prev, account])
    setForm(f => ({ ...f, account_id: account.id }))
    setShowAccMod(false)
  }

  const filtered = useMemo(() => trades.filter(t => {
    const matchSym = !filter || (t.symbol || '').toUpperCase().includes(filter.toUpperCase())
    const matchDir = dirFilter === 'all' || (t.direction || '').toLowerCase() === dirFilter
    return matchSym && matchDir
  }), [trades, filter, dirFilter])

  return (
    <>
      {showAccMod && <AccountModal onClose={() => setShowAccMod(false)} onCreated={handleAccountCreated} />}
      {editTrade  && <EditModal trade={editTrade} onClose={() => setEditTrade(null)} onSaved={handleSaved} />}

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 14, padding: 18, height: '100%', fontFamily: "'IBM Plex Sans', sans-serif", boxSizing: 'border-box' }}>

        {/* ── Log a Trade (unchanged) ── */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20, overflowY: 'auto' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: S.text, margin: '0 0 18px' }}>Log a Trade</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <JField label="Account">
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.account_id} onChange={e => field('account_id', e.target.value)}
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer' }} required>
                  {accounts.length === 0
                    ? <option value="">No accounts — create one →</option>
                    : accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.balance ? ` — $${Number(a.balance).toLocaleString()}` : ''}</option>)
                  }
                </select>
                <button type="button" onClick={() => setShowAccMod(true)} style={{
                  padding: '0 12px', background: S.border, border: `1px solid ${S.border2}`,
                  borderRadius: 8, color: S.green, fontSize: 18, cursor: 'pointer', fontWeight: 700, lineHeight: 1,
                }} title="New account">+</button>
              </div>
            </JField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <JField label="Symbol">
                <input value={form.symbol} required onChange={e => field('symbol', e.target.value.toUpperCase())} placeholder="EURUSD, NQ, BTC…" style={inputStyle} />
              </JField>
              <JField label="Entry Time">
                <input type="datetime-local" value={form.entry_time} required onChange={e => field('entry_time', e.target.value)} style={inputStyle} />
              </JField>
            </div>

            <JField label="Direction">
              <DirToggle value={form.direction} onChange={v => field('direction', v)} />
            </JField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <JField label="Entry Price">
                <input type="number" step="any" value={form.entry} required onChange={e => field('entry', e.target.value)} placeholder="0.00" style={inputStyle} />
              </JField>
              <JField label="Exit Price">
                <input type="number" step="any" value={form.exit} onChange={e => field('exit', e.target.value)} placeholder="0.00" style={inputStyle} />
              </JField>
              <JField label="Contracts">
                <input type="number" step="any" value={form.contracts} onChange={e => field('contracts', e.target.value)} placeholder="1" style={inputStyle} />
              </JField>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <JField label="Stop Loss">
                <input type="number" step="any" value={form.sl} onChange={e => field('sl', e.target.value)} placeholder="0.00" style={inputStyle} />
              </JField>
              <JField label="Take Profit">
                <input type="number" step="any" value={form.tp} onChange={e => field('tp', e.target.value)} placeholder="0.00" style={inputStyle} />
              </JField>
            </div>

            <JField label="Kill Zone">
              <ChipGroup options={KILL_ZONES} value={form.kill_zone} onChange={v => field('kill_zone', v)} color={S.blue} />
            </JField>

            <JField label="Setup">
              <ChipGroup options={SETUPS} value={form.setup} onChange={v => field('setup', v)} color={S.green} />
            </JField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <JField label="Emotion">
                <select value={form.emotion} onChange={e => field('emotion', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">— Select —</option>
                  {EMOTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
              </JField>
              <JField label="Grade">
                <ChipGroup options={GRADES} value={form.grade} onChange={v => field('grade', v)} color={S.yellow} />
              </JField>
            </div>

            <JField label="Exit Time (optional)">
              <input type="datetime-local" value={form.exit_time} onChange={e => field('exit_time', e.target.value)} style={inputStyle} />
            </JField>

            <JField label="Notes">
              <textarea value={form.notes} onChange={e => field('notes', e.target.value)}
                placeholder="Confluence, emotions, lessons…"
                style={{ ...inputStyle, minHeight: 68, resize: 'vertical' }} />
            </JField>

            {error && <ErrBox>{error}</ErrBox>}

            <PrimaryBtn type="submit" disabled={saving || accounts.length === 0}>
              {saving ? 'Logging…' : '+ Log Trade'}
            </PrimaryBtn>
          </form>
        </div>

        {/* ── Trade History ── */}
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: '0 0 1px' }}>Trade History</h2>
              <p style={{ fontSize: 11, color: S.dim, fontFamily: 'IBM Plex Mono', margin: 0 }}>{filtered.length} trade{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Filters */}
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Symbol…"
              style={{ ...inputStyle, width: 110, padding: '6px 10px', fontSize: 12 }} />
            <select value={dirFilter} onChange={e => setDirFilter(e.target.value)}
              style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, cursor: 'pointer', width: 'auto' }}>
              <option value="all">All</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>

            {/* View toggle */}
            <div style={{ display: 'flex', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}`, padding: 2, gap: 2 }}>
              {[{ mode: 'gallery', icon: LayoutGrid }, { mode: 'table', icon: List }].map(({ mode, icon: Icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)} title={mode} style={{
                  padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: viewMode === mode ? S.border2 : 'transparent',
                  color: viewMode === mode ? S.text : S.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Export */}
            <button onClick={() => exportCSV(filtered)} title="Export CSV" style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
              background: S.bg, border: `1px solid ${S.border}`, borderRadius: 8,
              color: S.muted, fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = S.green}
            onMouseLeave={e => e.currentTarget.style.color = S.muted}
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          </div>

          {/* Content */}
          <div style={{ overflowY: 'auto', flex: 1, padding: viewMode === 'gallery' ? '14px 16px' : 0 }}>
            {loading ? (
              <div style={{ padding: 16 }}>
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} style={{ height: 36, background: S.bg, borderRadius: 6, marginBottom: 6, opacity: 0.5 - i * 0.06 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 40 }}>
                <div style={{ fontSize: 36 }}>📋</div>
                <p style={{ fontSize: 13, color: S.dim, fontFamily: 'IBM Plex Mono' }}>No trades yet. Log one!</p>
              </div>
            ) : viewMode === 'gallery' ? (
              /* ── Gallery grid ── */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {filtered.map(t => (
                  <TradeCard key={t.id} trade={t}
                    onEdit={setEditTrade}
                    onDelete={handleDelete}
                    deleting={deleting === t.id}
                  />
                ))}
              </div>
            ) : (
              /* ── Table view ── */
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Symbol','Date','Dir','Kill Zone','Setup','P&L','R','Grade',''].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '8px 12px', fontSize: 9, color: S.dim,
                        fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', textTransform: 'uppercase',
                        fontWeight: 600, position: 'sticky', top: 0, background: S.surface,
                        borderBottom: `1px solid ${S.border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const pnl = t.pnl ?? 0
                    const pos = pnl >= 0
                    const dir = (t.direction || '').toLowerCase()
                    const kzLabel    = KILL_ZONES.find(k => k.value === t.kill_zone)?.label || '—'
                    const setupLabel = SETUPS.find(s => s.value === t.setup)?.label          || '—'
                    const gradeLabel = GRADES.find(g => g.value === t.grade)?.label          || '—'
                    return (
                      <tr key={t.id}
                        onMouseEnter={e => e.currentTarget.style.background = S.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ transition: 'background 0.1s' }}>
                        <td style={td}><span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: S.text }}>{t.symbol}</span></td>
                        <td style={td}><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: S.muted }}>{t.entry_time ? new Date(t.entry_time).toLocaleDateString() : '—'}</span></td>
                        <td style={td}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 600, background: dir === 'long' ? 'rgba(168,197,160,0.1)' : 'rgba(247,83,107,0.1)', color: dir === 'long' ? S.green : S.red }}>
                            {dir.toUpperCase()}
                          </span>
                        </td>
                        <td style={td}><span style={{ fontSize: 11, color: S.blue, fontFamily: 'IBM Plex Mono' }}>{kzLabel}</span></td>
                        <td style={td}><span style={{ fontSize: 11, color: S.green, fontFamily: 'IBM Plex Mono' }}>{setupLabel}</span></td>
                        <td style={td}><span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: 12, color: pos ? S.green : S.red }}>{pos ? '+' : ''}${Math.abs(pnl).toFixed(2)}</span></td>
                        <td style={td}><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: S.yellow }}>{t.r_multiple != null ? `${t.r_multiple}R` : '—'}</span></td>
                        <td style={td}>
                          <span style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, fontFamily: 'IBM Plex Mono', fontWeight: 600, background: t.grade?.includes('a') ? 'rgba(168,197,160,0.1)' : 'rgba(247,201,72,0.08)', color: t.grade?.includes('a') ? S.green : S.yellow }}>
                            {gradeLabel}
                          </span>
                        </td>
                        <td style={{ ...td, width: 64 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <IconBtn onClick={() => setEditTrade(t)}><Edit2 size={11} /></IconBtn>
                            <IconBtn onClick={() => handleDelete(t.id)} disabled={deleting === t.id} danger><Trash2 size={11} /></IconBtn>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Shared primitives ───────────────────────────────────────

function Overlay({ onClick, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClick}>
      {children}
    </div>
  )
}

function ModalCard({ width = 520, children }) {
  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'IBM Plex Sans', sans-serif" }}
      onClick={e => e.stopPropagation()}>
      {children}
    </div>
  )
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: S.text, margin: 0 }}>{title}</h2>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={16} />
      </button>
    </div>
  )
}

function DirToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[{ v: 'long', label: '▲ Long' }, { v: 'short', label: '▼ Short' }].map(({ v, label }) => (
        <button key={v} type="button" onClick={() => onChange(v)} style={{
          flex: 1, padding: '8px 12px', border: '1px solid',
          borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s', fontFamily: "'IBM Plex Sans', sans-serif",
          background:  value === v ? (v === 'long' ? 'rgba(168,197,160,0.18)' : 'rgba(247,83,107,0.18)') : S.bg,
          color:       value === v ? (v === 'long' ? S.green : S.red) : S.muted,
          borderColor: value === v ? (v === 'long' ? 'rgba(168,197,160,0.4)' : 'rgba(247,83,107,0.4)') : S.border,
        }}>{label}</button>
      ))}
    </div>
  )
}

function ChipGroup({ options, value, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(({ value: v, label }) => {
        const sel = value === v
        return (
          <button key={v} type="button" onClick={() => onChange(sel ? '' : v)} style={{
            padding: '5px 10px', border: '1px solid', borderRadius: 6,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
            fontFamily: 'IBM Plex Mono,monospace',
            background:  sel ? `${color}18` : S.bg,
            color:       sel ? color : S.muted,
            borderColor: sel ? `${color}55` : S.border,
          }}>{label}</button>
        )
      })}
    </div>
  )
}

function PrimaryBtn({ children, type = 'button', disabled, onClick, style = {} }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{
      padding: '12px', background: S.green, color: S.bg,
      border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      fontFamily: "'IBM Plex Sans', sans-serif",
      transition: 'opacity 0.15s',
      ...style,
    }}>
      {children}
    </button>
  )
}

function IconBtn({ children, onClick, disabled, danger, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      background: 'none',
      border: `1px solid ${danger ? 'rgba(247,83,107,0.2)' : S.border}`,
      borderRadius: 5, padding: '4px 7px', cursor: disabled ? 'not-allowed' : 'pointer',
      color: danger ? S.red : S.muted, opacity: disabled ? 0.5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'border-color 0.12s',
    }}>
      {children}
    </button>
  )
}

function ErrBox({ children }) {
  return (
    <p style={{ fontSize: 12, color: S.red, background: 'rgba(247,83,107,0.08)', borderRadius: 6, padding: '8px 12px', fontFamily: 'IBM Plex Mono', margin: 0 }}>
      {children}
    </p>
  )
}

function JField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, color: S.muted, fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: '#0d0f14', border: '1px solid #1e2230',
  borderRadius: 8, padding: '9px 12px',
  fontSize: 13, color: '#e8eaf0', outline: 'none',
  fontFamily: 'IBM Plex Mono,monospace',
  transition: 'border-color 0.15s',
}

const td = {
  padding: '9px 12px', fontSize: 12, color: '#c8cfe0',
  borderBottom: '1px solid rgba(30,34,48,0.6)',
}