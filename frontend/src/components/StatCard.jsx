import clsx from 'clsx'

export default function StatCard({ label, value, accent = 'blue', icon: Icon }) {
  const colorMap = {
    blue:   'text-forge-accent',
    green:  'text-forge-green',
    red:    'text-forge-red',
    yellow: 'text-forge-yellow',
    purple: 'text-forge-purple',
  }
  const glowMap = {
    blue:   'from-transparent via-forge-accent/40 to-transparent',
    green:  'from-transparent via-forge-green/40  to-transparent',
    red:    'from-transparent via-forge-red/40    to-transparent',
    yellow: 'from-transparent via-forge-yellow/40 to-transparent',
    purple: 'from-transparent via-forge-purple/40 to-transparent',
  }

  return (
    <div className="stat-card group">
      <div className={clsx('absolute inset-x-0 top-0 h-px bg-gradient-to-r', glowMap[accent])} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-forge-subtle font-mono uppercase tracking-widest mb-2">{label}</p>
          <p className={clsx('text-2xl font-semibold font-mono', colorMap[accent])}>
            {value ?? '—'}
          </p>
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-lg border border-forge-border flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
            <Icon size={16} className={colorMap[accent]} />
          </div>
        )}
      </div>
    </div>
  )
}
