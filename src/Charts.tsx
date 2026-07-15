import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, TooltipProps,
} from 'recharts'
import type { Subject, WeeklyChartData, SubjectTotal } from './types'
import {
  getSubjects, getSettings, getWeeklyStats, getSubjectTotals,
} from './db'
import { lightTokens, darkTokens, getTokens } from './theme'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMin(m: number): string {
  if (m === 0) return '0分'
  const h   = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}分`
  if (min === 0) return `${h}時間`
  return `${h}時間${min}分`
}

// ── Week navigation helpers ───────────────────────────────────────────────────

function getWeekBounds(offset: number): { monday: Date; sunday: Date } {
  const today  = new Date()
  const dow    = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function getWeekLabel(offset: number): string {
  if (offset === 0)  return '今週'
  if (offset === -1) return '先週'
  const { monday, sunday } = getWeekBounds(offset)
  const m1 = monday.getMonth() + 1; const d1 = monday.getDate()
  const m2 = sunday.getMonth() + 1; const d2 = sunday.getDate()
  return m1 === m2
    ? `${m1}月${d1}〜${d2}日`
    : `${m1}月${d1}日〜${m2}月${d2}日`
}

// ── Weekly Chart ──────────────────────────────────────────────────────────────

interface WeeklyChartProps {
  data: WeeklyChartData
}

function WeeklyBarChart({ data }: WeeklyChartProps) {
  const tokens     = getTokens()
  const goalColor  = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(0,0,0,0.08)'

  // Build flat data rows that Recharts can consume.
  // Each subject's minutes are spread as top-level keys.
  const chartData = data.days.map(day => {
    const entry: Record<string, unknown> = {
      label:         day.label,
      date:          day.date,
      isToday:       day.isToday,
      goalMinutes:   day.goalMinutes,
      totalMinutes:  day.totalMinutes,
      goalRemaining: day.goalRemaining,
    }
    Object.entries(day.bySubject).forEach(([id, mins]) => { entry[id] = mins })
    return entry
  })

  // Custom tick highlights today's label with the primary color.
  const renderXTick = (props: {
    x?: number; y?: number; payload?: { value: string }
  }) => {
    const { x = 0, y = 0, payload } = props
    const day     = data.days.find(d => d.label === payload?.value)
    const isToday = day?.isToday ?? false
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0} y={0} dy={14}
          textAnchor="middle"
          fontSize={12}
          fontWeight={isToday ? 700 : 400}
          style={{ fill: isToday ? tokens.primary : tokens.onSurfaceVariant }}
        >
          {payload?.value}
        </text>
        {isToday && (
          <circle cx={0} cy={24} r={2.5} style={{ fill: tokens.primary }} />
        )}
      </g>
    )
  }

  // Custom tooltip — numbers shown only here, never inside bars.
  // Rechartsの公式の型（TooltipProps）を割り当てて、厳格な型チェックをクリアします
  const renderTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload } = props
    if (!active || !payload?.length) return null

    const row        = (payload[0].payload ?? {}) as Record<string, unknown>
    const label      = row.label as string
    const goalMin    = (row.goalMinutes as number) ?? 0

    // Future days have goalMinutes === 0 — nothing to show
    if (goalMin === 0 && (row.totalMinutes as number) === 0) return null

    const subjectRows = payload.filter(
      p => p.dataKey !== 'goalRemaining' && p.value !== undefined && p.value > 0
    )
    const total = subjectRows.reduce((s, p) => s + ((p.value as number) ?? 0), 0)

    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-date">{label}曜日</p>

        {total === 0 ? (
          <p className="chart-tooltip-empty">学習記録なし</p>
        ) : (
          <>
            {subjectRows.map(p => {
              const subj = data.subjects.find(s => s.id === p.dataKey)
              if (!subj) return null
              return (
                <div key={p.dataKey} className="chart-tooltip-row">
                  <span className="chart-tooltip-dot" style={{ backgroundColor: subj.color }} />
                  <span className="chart-tooltip-name">{subj.name}</span>
                  <span className="chart-tooltip-val">{formatMin((p.value as number) ?? 0)}</span>
                </div>
              )
            })}
            <div className="chart-tooltip-divider" />
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-name">合計</span>
              <span className="chart-tooltip-val">{formatMin(total)}</span>
            </div>
          </>
        )}

        {goalMin > 0 && (
          <div className="chart-tooltip-row chart-tooltip-goal-row">
            <span className="chart-tooltip-name">目標</span>
            <span className="chart-tooltip-val">{formatMin(goalMin)}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 4, left: -28, bottom: 0 }}
        barCategoryGap="22%"
      >
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={renderXTick}
          height={32}
        />
        {/* Y axis intentionally hidden — numbers accessible via tooltip only */}
        <YAxis hide />
        <Tooltip
          content={renderTooltip}
          cursor={{ fill: 'transparent' }}
          isAnimationActive={false}
        />

        {/* Subject bars (stacked, subject color) */}
        {data.subjects.map(s => (
          <Bar key={s.id} dataKey={s.id} stackId="a" fill={s.color} />
        ))}

        {/* Goal-remaining bar (gray) — always on top of the stack */}
        <Bar dataKey="goalRemaining" stackId="a" fill={goalColor} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
// ── Cumulative Chart ──────────────────────────────────────────────────────────

interface CumulativeChartProps {
  totals: SubjectTotal[]
}

function CumulativeBarChart({ totals }: CumulativeChartProps) {
  const tokens    = getTokens()
  const chartData = totals.map(st => ({
    name:    st.subject.name,
    minutes: st.totalMinutes,
    color:   st.subject.color,
  }))

  // Dynamic height: at least 160px; 52px per bar
  const chartHeight = Math.max(160, totals.length * 52)

  const renderTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload } = props
    if (!active || !payload?.length) return null
    const { name, minutes, color } = (payload[0].payload ?? { name: '', minutes: 0, color: '' }) as { name: string; minutes: number; color: string }
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ backgroundColor: color }} />
          <span className="chart-tooltip-name">{name}</span>
          <span className="chart-tooltip-val">{formatMin(minutes)}</span>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        barCategoryGap="24%"
      >
        {/* X axis (time values) intentionally hidden */}
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={88}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 13, fontWeight: 500, fill: tokens.onSurface }}
        />
        <Tooltip
          content={renderTooltip}
          cursor={{ fill: 'transparent' }}
          isAnimationActive={false}
        />
        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} maxBarSize={36}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Charts Screen ─────────────────────────────────────────────────────────────

export default function Charts() {
  const [weeklyData,    setWeeklyData]    = useState<WeeklyChartData | null>(null)
  const [subjectTotals, setSubjectTotals] = useState<SubjectTotal[]>([])
  const [hasSubjects,   setHasSubjects]   = useState(true)
  const [loading,       setLoading]       = useState(true)
  // 追加
  const [weekOffset,    setWeekOffset]    = useState(0)

  const load = useCallback(async () => {
    try {
      const [subjects, settings] = await Promise.all([getSubjects(), getSettings()])
      setHasSubjects(subjects.length > 0)

      if (subjects.length > 0) {
        const [weekly, totals] = await Promise.all([
          getWeeklyStats(subjects, settings, weekOffset),
          getSubjectTotals(subjects),
        ])
        setWeeklyData(weekly)
        setSubjectTotals(totals)
      }
    } catch (err) {
      console.error('Charts load error:', err)
    } finally {
      setLoading(false)
    }
  }, [weekOffset])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  // ── Loading ──
  if (loading) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h1 className="screen-title">グラフ</h1>
        </div>
        <div className="empty-state">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  // ── No subjects ──
  if (!hasSubjects) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h1 className="screen-title">グラフ</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="9.5" width="3" height="9.5" rx="1" />
              <rect x="10.5" y="5" width="3" height="14" rx="1" />
              <rect x="16" y="13" width="3" height="6" rx="1" />
            </svg>
          </div>
          <p className="empty-state-title">教科を追加してください</p>
          <p className="empty-state-body">グラフを表示するには教科の登録が必要です</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">グラフ</h1>
      </div>

      {/* ── Weekly chart ── */}
      // 変更後
      <section className="chart-section">
        <div className="chart-section-header">
          <h2 className="chart-section-title">週間学習</h2>
          <div className="chart-week-nav">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setWeekOffset(w => w - 1)}
              aria-label="前の週"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <span className="chart-week-label">{getWeekLabel(weekOffset)}</span>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setWeekOffset(w => w + 1)}
              disabled={weekOffset >= 0}
              aria-label="次の週"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </div>
        </div>
        {weeklyData ? (
          <div className="chart-container">
            <WeeklyBarChart data={weeklyData} />
          </div>
        ) : (
          <div className="chart-empty">データを読み込み中...</div>
        )}
      </section>

      {/* ── Cumulative chart ── */}
      <section className="chart-section mt-24">
        <h2 className="chart-section-title">教科別累計</h2>
        {subjectTotals.length > 0 ? (
          <div className="chart-container">
            <CumulativeBarChart totals={subjectTotals} />
          </div>
        ) : (
          <div className="chart-empty">学習記録がまだありません</div>
        )}
      </section>
    </div>
  )
}