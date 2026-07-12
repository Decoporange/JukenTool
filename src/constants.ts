import type { AppSettings, TabId } from './types'

// ── IndexedDB ────────────────────────────────────────────────────────────────

export const DB_NAME = 'StudyTrackerDB'
export const DB_VERSION = 1
export const SETTINGS_KEY = 'appSettings'

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  weekdayGoalMinutes: 480,   // 8 hours
  holidayGoalMinutes: 600,   // 10 hours
  commonTestDate: null,
}

// Minimum duration to save a timer record
export const MIN_TIMER_SECONDS = 60

// ── Navigation ────────────────────────────────────────────────────────────────

export const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'ホーム' },
  { id: 'timer',     label: 'タイマー' },
  { id: 'charts',    label: 'グラフ' },
  { id: 'subjects',  label: '教科' },
  { id: 'settings',  label: '設定' },
]

// ── Preset subject colors ─────────────────────────────────────────────────────

export const PRESET_COLORS = [
  '#E53935', // Red
  '#1E88E5', // Blue
  '#43A047', // Green
  '#8E24AA', // Purple
  '#FB8C00', // Orange
  '#00ACC1', // Cyan
  '#F4511E', // Deep Orange
  '#6D4C41', // Brown
  '#039BE5', // Light Blue
  '#00897B', // Teal
] as const