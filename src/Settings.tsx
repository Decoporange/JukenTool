import React, { useState, useEffect } from 'react'
import type { AppSettings } from './types'
import { getSettings, saveSettings } from './db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGoalTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Settings ──────────────────────────────────────────────────────────────────

export default function Settings() {
  const [settings,  setSettings]  = useState<AppSettings | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [savedMsg,  setSavedMsg]  = useState(false)
  const [dateError, setDateError] = useState('')

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error)
  }, [])

  // ── Loading ──
  if (!settings) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h1 className="screen-title">設定</h1>
        </div>
        <div className="empty-state">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  // ── Validation ──
  const validate = (): boolean => {
    if (settings.commonTestDate) {
      const d = new Date(settings.commonTestDate)
      if (isNaN(d.getTime())) {
        setDateError('有効な日付を入力してください')
        return false
      }
    }
    setDateError('')
    return true
  }

  // ── Save ──
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await saveSettings(settings)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch (err) {
      console.error('Settings save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1 className="screen-title">設定</h1>
        <p className="screen-subtitle">目標時間と試験日程を設定する</p>
      </div>

      {/* ── 目標学習時間 ── */}
      <div className="settings-section">
        <h2 className="settings-section-title">目標学習時間</h2>
        <div className="settings-card">

          {/* 平日 */}
          <div className="settings-goal-row">
            <div className="settings-goal-header">
              <span className="settings-goal-label">平日</span>
              <span className="settings-goal-value">
                {formatGoalTime(settings.weekdayGoalMinutes)}
              </span>
            </div>
            <input
              type="range"
              className="settings-slider"
              min={30}
              max={960}
              step={30}
              value={settings.weekdayGoalMinutes}
              onChange={(e) => update('weekdayGoalMinutes', parseInt(e.target.value))}
              aria-label="平日の目標学習時間"
            />
            <div className="settings-slider-ends">
              <span>30分</span>
              <span>16時間</span>
            </div>
          </div>

          <div className="divider" style={{ margin: '20px 0' }} />

          {/* 休日 */}
          <div className="settings-goal-row">
            <div className="settings-goal-header">
              <span className="settings-goal-label">休日</span>
              <span className="settings-goal-value">
                {formatGoalTime(settings.holidayGoalMinutes)}
              </span>
            </div>
            <input
              type="range"
              className="settings-slider"
              min={30}
              max={960}
              step={30}
              value={settings.holidayGoalMinutes}
              onChange={(e) => update('holidayGoalMinutes', parseInt(e.target.value))}
              aria-label="休日の目標学習時間"
            />
            <div className="settings-slider-ends">
              <span>30分</span>
              <span>16時間</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── 共通テスト ── */}
      <div className="settings-section mt-24">
        <h2 className="settings-section-title">共通テスト</h2>
        <div className="settings-card">
          <div className="field">
            <label className="field-label" htmlFor="test-date-input">
              試験日程
            </label>
            <input
              id="test-date-input"
              type="date"
              className="field-input"
              value={settings.commonTestDate ?? ''}
              min={todayStr()}
              onChange={(e) => {
                update('commonTestDate', e.target.value || null)
                setDateError('')
              }}
            />
            {dateError && <p className="field-error">{dateError}</p>}
          </div>

          {settings.commonTestDate && (
            <button
              type="button"
              className="btn btn-text"
              style={{ marginTop: 4 }}
              onClick={() => { update('commonTestDate', null); setDateError('') }}
            >
              日程をクリア
            </button>
          )}
        </div>
      </div>

      {/* ── 保存ボタン ── */}
      <button
        type="button"
        className="btn btn-filled full-w mt-32"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? '保存中...' : '保存する'}
      </button>

      {/* ── 保存完了トースト ── */}
      {savedMsg && (
        <div className="snackbar" role="status" aria-live="polite">
          設定を保存しました
        </div>
      )}
    </div>
  )
}