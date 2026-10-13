'use client'

import { useMemo } from 'react'

export type PlatformActivity = {
  timezone: string
  daily: Array<{ day: string; visitors: number; signedInUsers: number; visitTracking: boolean }>
}

const series = [
  { key: 'visitors' as const, label: 'Visitors', colour: '#a3dbff' },
  { key: 'signedInUsers' as const, label: 'Signed-in users', colour: '#c1a7ff' },
]

function label(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function DailyActivityChart({ activity, rangeDays }: { activity: PlatformActivity; rangeDays: number }) {
  const chart = useMemo(() => {
    const width = 760, height = 220, left = 44, top = 18, plotWidth = 700, plotHeight = 168
    const max = Math.max(1, ...activity.daily.flatMap(day => [day.visitors, day.signedInUsers]))
    const points = activity.daily.map((day, index) => ({ ...day, x: left + (activity.daily.length === 1 ? .5 : index / (activity.daily.length - 1)) * plotWidth }))
    const y = (value: number) => top + plotHeight - value / max * plotHeight
    const labels = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter(index => index >= 0)
    return { width, height, left, top, plotWidth, plotHeight, max, points, y, labels }
  }, [activity.daily])
  const today = activity.daily.at(-1)
  return <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-5" aria-labelledby="daily-platform-activity-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h3 id="daily-platform-activity-title" className="text-xl font-semibold">Daily platform activity</h3><p className="mt-1 text-sm text-text-secondary">People visiting BVS and members active while signed in.</p></div>
      <div className="flex gap-6">
        {series.map(item => <div key={item.key}><p className="text-xs text-text-secondary">{item.label} today</p><p className="mt-1 text-2xl font-semibold" style={{ color: item.colour }}>{(today?.[item.key] || 0).toLocaleString()}</p></div>)}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap gap-5 text-xs">
      {series.map(item => <span key={item.key} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5" style={{ backgroundColor: item.colour }} aria-hidden="true" />{item.label}</span>)}
      <span className="text-text-secondary">Daily unique counts · {activity.timezone}</span>
    </div>
    <div className="mt-4 overflow-hidden rounded-xl border border-white/[.06] bg-black/20 px-2 py-3">
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-52 w-full" role="img" aria-label={`Daily visitors and signed-in users over ${rangeDays} days`}>
        <title>Daily platform activity</title><desc>Blue shows unique visitors by browser or device. Purple shows unique signed-in accounts. Exact daily values are available in the table below.</desc>
        {[0, .5, 1].map(ratio => <g key={ratio}>
          <line x1={chart.left} y1={chart.top + chart.plotHeight * ratio} x2={chart.left + chart.plotWidth} y2={chart.top + chart.plotHeight * ratio} stroke="currentColor" strokeDasharray="4 7" className="text-white/10" />
          <text x={chart.left - 10} y={chart.top + chart.plotHeight * ratio + 4} textAnchor="end" fill="currentColor" className="text-[11px] text-text-secondary">{Math.round(chart.max * (1 - ratio))}</text>
        </g>)}
        {series.map(item => <g key={item.key}>
          <polyline points={chart.points.map(point => `${point.x},${chart.y(point[item.key])}`).join(' ')} fill="none" stroke={item.colour} strokeWidth="3" strokeDasharray={item.key === 'signedInUsers' ? '7 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          {chart.points.map(point => <circle key={point.day} cx={point.x} cy={chart.y(point[item.key])} r="3" fill={item.colour} stroke="#111" strokeWidth="1"><title>{label(point.day)}: {point[item.key]} {item.label.toLowerCase()}</title></circle>)}
        </g>)}
        {chart.labels.map(index => { const point = chart.points[index]; return point ? <text key={point.day} x={point.x} y={chart.height - 9} textAnchor={index === 0 ? 'start' : index === chart.points.length - 1 ? 'end' : 'middle'} fill="currentColor" className="text-[11px] text-text-secondary">{label(point.day)}</text> : null })}
      </svg>
    </div>
    <p className="mt-3 text-xs leading-5 text-text-secondary">Visitors include guests and signed-in members, counted once per browser or device each day. Signed-in users count accounts once per day, even across devices. These series overlap. Analytics opt-outs are excluded; today is still in progress.</p>
    <p className="mt-2 text-xs leading-5 text-text-secondary">Earlier dates use recorded activity. Browsing-only visit tracking starts with this update, so historical browsing totals may be lower.</p>
    <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm text-text-secondary">View daily numbers</summary><div className="max-h-72 overflow-auto">
      <table className="w-full text-left text-xs"><caption className="sr-only">Daily activity counts in {activity.timezone}</caption><thead><tr className="border-b border-white/10"><th scope="col" className="py-2">Date</th><th scope="col" className="py-2 text-right">Visitors</th><th scope="col" className="py-2 text-right">Signed-in users</th></tr></thead><tbody>
        {activity.daily.map(day => <tr key={day.day} className="border-b border-white/[.05]"><th scope="row" className="py-2 font-normal">{day.day}</th><td className="py-2 text-right">{day.visitors}</td><td className="py-2 text-right">{day.signedInUsers}</td></tr>)}
      </tbody></table>
    </div></details>
  </section>
}
