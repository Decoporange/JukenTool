import React, { useState, useEffect } from 'react'
import type { Subject } from './types'
import { getSubjects, addRecord } from './db'
import { useTimer } from './App'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ── Manual Record Modal ───────────────────────────────────────────────────────

interface ManualModalProps {
  subjects: Subject[]
  initialSubjectId: string
  onClose: () => void
  onSaved: () => void
}

function ManualRecordModal({ subjects, initialSubjectId, onClose, onSaved }: ManualModalProps) {
  const [subjectId, setSubjectId] = useState(initialSubjectId)
  const [hours,     setHours]     = useState(0)
  const [minutes,   setMinutes]   = useState(30)
  const [date,      setDate]      = useState(todayStr())
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const canSave = !!subjectId && (hours > 0 || minutes > 0)

  const handleSave = async () => {
    if (!canSave) {
      setError('教科と学習時間を入力してください')
      return
    }
    setSaving(true)
    try {
      await addRecord({
        subjectId,
        durationMinutes: hours * 60 + minutes,
        date,
        startedAt: null,
        endedAt:   null,
        type:      'manual',
      })
      onSaved()
      onClose()
    } catch (err) {
      console.error('Manual record save failed:', err)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">手動で記録</h2>

        {/* Subject */}
        <div className="field">
          <span className="field-label">教科</span>
          <div className="chips-row">
            {subjects.map(s => (
              <button
                key={s.id}
                type="button"
                className={`chip${subjectId === s.id ? ' chip--selected' : ''}`}
                onClick={() => { setSubjectId(s.id); setError('') }}
              >
                <span className="chip-dot" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="field">
          <span className="field-label">学習時間</span>
          <div className="time-inputs-row">
            <div className="time-input-group">
              <input
                type="number"
                className="field-input time-number-input"
                value={hours}
                min={0}
                max={24}
                onChange={(e) => {
                  setHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))
                  setError('')
                }}
              />
              <span className="time-unit-label">時間</span>
            </div>
            <div className="time-input-group">
              <input
                type="number"
                className="field-input time-number-input"
                value={minutes}
                min={0}
                max={59}
                onChange={(e) => {
                  setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))
                  setError('')
                }}
              />
              <span className="time-unit-label">分</span>
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="field">
          <span className="field-label">日付</span>
          <input
            type="date"
            className="field-input"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="row gap-12 mt-24">
          <button type="button" className="btn btn-outlined flex-1" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn btn-filled flex-1"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Timer Screen ──────────────────────────────────────────────────────────────

export default function Timer() {
  const { timerState, startTimer, stopTimer, resetTimer } = useTimer()

  const [subjects,   setSubjects]   = useState<Subject[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [showManual, setShowManual] = useState(false)
  const [savedMsg,   setSavedMsg]   = useState(false)

  // Load subjects on mount. Tab changes remount this screen, so this always stays fresh.
  useEffect(() => {
    getSubjects().then(subs => {
      setSubjects(subs)
      // Set initial selection: prefer the running subject, else first subject
      setSelectedId(prev => {
        if (prev) return prev
        if (timerState.isRunning && timerState.subjectId) return timerState.subjectId
        return subs[0]?.id ?? ''
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When timer state is restored (after page reload), sync selected chip
  useEffect(() => {
    if (timerState.isRunning && timerState.subjectId) {
      setSelectedId(timerState.subjectId)
    }
  }, [timerState.isRunning, timerState.subjectId])

  const showSavedToast = () => {
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2500)
  }

  const handleStart = () => {
    if (!selectedId || subjects.length === 0) return
    startTimer(selectedId)
  }

  const handleStop = async () => {
    await stopTimer()
    showSavedToast()
  }

  const handleReset = () => {
    resetTimer()
  }

  // During timer: show running subject; otherwise show the user's chip selection
  const displaySubjectId = timerState.isRunning ? (timerState.subjectId ?? '') : selectedId
  const activeSubject    = subjects.find(s => s.id === displaySubjectId)

  return (
    <div className="screen timer-screen">
      <div className="screen-header">
        <h1 className="screen-title">タイマー</h1>
      </div>

      {/* ── Subject chips ── */}
      {subjects.length === 0 ? (
        <div className="timer-no-subjects">
          <p className="type-body-md text-secondary">
            教科タブから教科を追加してください
          </p>
        </div>
      ) : (
        <div className="chips-scroll" role="group" aria-label="教科を選択">
          {subjects.map(s => {
            const isActive   = s.id === displaySubjectId
            const isDisabled = timerState.isRunning && s.id !== timerState.subjectId
            return (
              <button
                key={s.id}
                type="button"
                className={[
                  'chip',
                  isActive   ? 'chip--selected' : '',
                  isDisabled ? 'chip--disabled'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => { if (!timerState.isRunning) setSelectedId(s.id) }}
                disabled={isDisabled}
                aria-pressed={isActive}
              >
                <span className="chip-dot" style={{ backgroundColor: s.color }} />
                {s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Time display ── */}
      <div className="timer-display">
        {/* Subject name above the clock */}
        {activeSubject ? (
          <div className="timer-subject-tag">
            <span className="timer-subject-dot" style={{ backgroundColor: activeSubject.color }} />
            <span>{activeSubject.name}</span>
          </div>
        ) : (
          <div className="timer-subject-tag timer-subject-tag--idle">
            <span>{timerState.isRunning ? '...' : '教科を選択'}</span>
          </div>
        )}

        {/* HH:MM:SS — calculated from wall-clock startedAt (no simple increment) */}
        <div
          className={`timer-time${timerState.isRunning ? ' timer-time--running' : ''}`}
          aria-live="polite"
          aria-label={`経過時間 ${formatHMS(timerState.elapsedSeconds)}`}
        >
          {formatHMS(timerState.elapsedSeconds)}
        </div>

        {/* Pulse ring while running */}
        {timerState.isRunning && (
          <div className="timer-pulse-ring" aria-hidden="true" />
        )}
      </div>

      {/* ── Main action button ── */}
      <div className="timer-controls">
        {timerState.isRunning ? (
          <button
            type="button"
            className="btn btn-round btn-round--stop"
            onClick={handleStop}
            aria-label="タイマーを終了して記録を保存"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
            <span>終了</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-round btn-round--start"
            onClick={handleStart}
            disabled={!selectedId || subjects.length === 0}
            aria-label="タイマーを開始"
          >
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>開始</span>
          </button>
        )}
      </div>

      {/* ── Secondary actions ── */}
      <div className="timer-secondary-actions">
        {timerState.isRunning && (
          <button type="button" className="btn btn-text" onClick={handleReset}>
            リセット（破棄）
          </button>
        )}
        <button
          type="button"
          className="btn btn-outlined"
          onClick={() => setShowManual(true)}
          disabled={subjects.length === 0}
        >
          手動で記録
        </button>
      </div>

      {/* ── Saved toast ── */}
      {savedMsg && (
        <div className="snackbar" role="status" aria-live="polite">
          記録を保存しました
        </div>
      )}

      {/* ── Manual record modal ── */}
      {showManual && subjects.length > 0 && (
        <ManualRecordModal
          subjects={subjects}
          initialSubjectId={displaySubjectId || subjects[0].id}
          onClose={() => setShowManual(false)}
          onSaved={showSavedToast}
        />
      )}
    </div>
  )
}