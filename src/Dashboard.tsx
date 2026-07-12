import React, { useState, useEffect, useCallback } from 'react'
import type { DashboardStats, TabId } from './types'
import { getDashboardStats, getSettings, getSubjects } from './db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes === 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

function getDateLabel(): string {
  const now  = new Date()
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'おはようございます'
  if (h >= 12 && h < 17) return 'こんにちは'
  if (h >= 17 && h < 21) return 'こんばんは'
  return 'お疲れ様です'
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  variant?: 'default' | 'primary' | 'tonal'
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${variant}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

// ── CountdownCard ─────────────────────────────────────────────────────────────

interface CountdownCardProps {
  days: number | null
  onSetDate: () => void
}

function CountdownCard({ days, onSetDate }: CountdownCardProps) {
  if (days === null) {
    return (
      <button
        className="stat-card stat-card--unset btn"
        onClick={onSetDate}
        aria-label="共通テストの日程を設定する"
      >
        <span className="stat-label">共通テスト</span>
        <span className="stat-cta-text">日程を設定 →</span>
      </button>
    )
  }

  return (
    <div className={`stat-card stat-card--countdown${days <= 30 ? ' stat-card--urgent' : ''}`}>
      <span className="stat-label">共通テストまで</span>
      <div className="stat-days-row">
        <span className="stat-days-num">{days}</span>
        <span className="stat-days-unit">日</span>
      </div>
    </div>
  )
}

// ── StreakCard ────────────────────────────────────────────────────────────────

function StreakCard({ streak }: { streak: number }) {
  const hasStreak = streak > 0
  return (
    <div
      className={`stat-card stat-card--streak${hasStreak ? ' stat-card--streak-active' : ''}`}
    >
      <div className="streak-body">
        <span className="stat-label">連続学習</span>
        {hasStreak ? (
          <div className="streak-row">
            <span className="streak-num">{streak}</span>
            <span className="streak-unit">日</span>
          </div>
        ) : (
          <span className="streak-zero">今日から始めよう</span>
        )}
      </div>
      <div className="streak-icon" aria-hidden="true">
        {/* Flame icon */}
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M13.5 0.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
        </svg>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div aria-hidden="true">
      <div className="stat-grid">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stat-card stat-card--skeleton" />
        ))}
      </div>
      <div className="stat-card stat-card--streak stat-card--skeleton mt-12" />
    </div>
  )
}

// ── Empty: no subjects ────────────────────────────────────────────────────────

function EmptySubjects({ onGo }: { onGo: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>
      <p className="empty-state-title">教科を登録しましょう</p>
      <p className="empty-state-body">教科を追加すると、タイマーで学習を記録できます</p>
      <button className="btn btn-filled mt-16" onClick={onGo}>
        教科を追加する
      </button>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (tab: TabId) => void
}

export default function Dashboard({ onNavigate }: Props) {
  const [stats,       setStats]       = useState<DashboardStats | null>(null)
  const [hasSubjects, setHasSubjects] = useState(true)
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    try {
      const [settings, subjects] = await Promise.all([getSettings(), getSubjects()])
      const dashStats = await getDashboardStats(settings)
      setHasSubjects(subjects.length > 0)
      setStats(dashStats)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  return (
    <div className="screen">
      <div className="screen-header">
        <p className="screen-subtitle">{getGreeting()}</p>
        <h1 className="screen-title">{getDateLabel()}</h1>
      </div>

      {loading && <SkeletonGrid />}

      {!loading && !hasSubjects && (
        <EmptySubjects onGo={() => onNavigate('subjects')} />
      )}

      {!loading && hasSubjects && stats !== null && (
        <>
          <div className="stat-grid">
            <StatCard
              label="今日"
              value={formatDuration(stats.todayMinutes)}
              variant="primary"
            />
            <StatCard
              label="今週"
              value={formatDuration(stats.weekMinutes)}
            />
            <StatCard
              label="7日間平均"
              value={formatDuration(stats.recentAvgMinutes)}
              variant="tonal"
            />
            <CountdownCard
              days={stats.daysUntilTest}
              onSetDate={() => onNavigate('settings')}
            />
          </div>
          <StreakCard streak={stats.streak} />
        </>
      )}
    </div>
  )
}