// ── Core Data ────────────────────────────────────────────────────────────────

export interface Subject {
  id: string
  name: string
  color: string   // HEX e.g. "#E53935"
  order: number
  createdAt: number
}

export interface StudyRecord {
  id: string
  subjectId: string
  durationMinutes: number
  date: string            // "YYYY-MM-DD"
  startedAt: number | null
  endedAt: number | null
  type: 'timer' | 'manual'
  createdAt: number
}

export interface AppSettings {
  weekdayGoalMinutes: number
  holidayGoalMinutes: number
  commonTestDate: string | null  // "YYYY-MM-DD"
}

// ── UI State ─────────────────────────────────────────────────────────────────

export interface TimerState {
  isRunning: boolean
  subjectId: string | null
  startedAt: number | null
  elapsedSeconds: number
}

export interface TimerContextType {
  timerState: TimerState
  startTimer: (subjectId: string) => void
  stopTimer: () => Promise<void>
  resetTimer: () => void
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface DailyStats {
  date: string
  totalMinutes: number
  bySubject: Record<string, number>  // subjectId → minutes
}

export interface SubjectTotal {
  subject: Subject
  totalMinutes: number
}

export interface DashboardStats {
  todayMinutes: number
  weekMinutes: number
  recentAvgMinutes: number      // average over last 7 calendar days
  daysUntilTest: number | null
  streak: number                // consecutive study days (0 if never studied)
}

// ── Charts ────────────────────────────────────────────────────────────────────

export interface WeekDayData {
  date: string
  label: string                      // '月' | '火' | '水' | '木' | '金' | '土' | '日'
  isToday: boolean
  goalMinutes: number                // 0 for future days
  totalMinutes: number
  goalRemaining: number              // Math.max(0, goal - total); 0 for future days
  bySubject: Record<string, number>  // subjectId → minutes
}

export interface WeeklyChartData {
  days: WeekDayData[]
  subjects: Subject[]
}

// ── Navigation ────────────────────────────────────────────────────────────────

export type TabId = 'dashboard' | 'timer' | 'charts' | 'subjects' | 'settings'