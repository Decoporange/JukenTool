import { openDB, type IDBPDatabase } from 'idb'
import type {
  Subject, StudyRecord, AppSettings, DailyStats, DashboardStats,
  SubjectTotal, WeekDayData, WeeklyChartData,
} from './types'
import { DB_NAME, DB_VERSION, SETTINGS_KEY, DEFAULT_SETTINGS } from './constants'

// ── DB singleton ──────────────────────────────────────────────────────────────

type StudyDB = IDBPDatabase

let _db: StudyDB | null = null

async function getDB(): Promise<StudyDB> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const ss = database.createObjectStore('subjects', { keyPath: 'id' })
      ss.createIndex('order', 'order')
      const rs = database.createObjectStore('records', { keyPath: 'id' })
      rs.createIndex('date', 'date')
      rs.createIndex('subjectId', 'subjectId')
      database.createObjectStore('settings', { keyPath: 'key' })
    },
  })
  return _db
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Subjects ──────────────────────────────────────────────────────────────────

export async function getSubjects(): Promise<Subject[]> {
  const d = await getDB()
  return d.getAllFromIndex('subjects', 'order') as Promise<Subject[]>
}

export async function addSubject(data: Omit<Subject, 'id' | 'createdAt'>): Promise<Subject> {
  const d = await getDB()
  const subject: Subject = { ...data, id: genId(), createdAt: Date.now() }
  await d.put('subjects', subject)
  return subject
}

export async function updateSubject(subject: Subject): Promise<void> {
  const d = await getDB()
  await d.put('subjects', subject)
}

export async function deleteSubject(id: string): Promise<void> {
  const d = await getDB()
  await d.delete('subjects', id)
}

// ── Records ───────────────────────────────────────────────────────────────────

export async function getRecords(from: string, to: string): Promise<StudyRecord[]> {
  const d = await getDB()
  return d.getAllFromIndex('records', 'date', IDBKeyRange.bound(from, to)) as Promise<StudyRecord[]>
}

export async function addRecord(data: Omit<StudyRecord, 'id' | 'createdAt'>): Promise<StudyRecord> {
  const d = await getDB()
  const record: StudyRecord = { ...data, id: genId(), createdAt: Date.now() }
  await d.put('records', record)
  return record
}

export async function deleteRecord(id: string): Promise<void> {
  const d = await getDB()
  await d.delete('records', id)
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const d = await getDB()
  const entry = await d.get('settings', SETTINGS_KEY) as
    | { key: string; value: AppSettings }
    | undefined
  return entry?.value ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const d = await getDB()
  await d.put('settings', { key: SETTINGS_KEY, value: settings })
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export function aggregateByDate(records: StudyRecord[]): DailyStats[] {
  const map = new Map<string, DailyStats>()
  for (const r of records) {
    if (!map.has(r.date)) {
      map.set(r.date, { date: r.date, totalMinutes: 0, bySubject: {} })
    }
    const day = map.get(r.date)!
    day.totalMinutes += r.durationMinutes
    day.bySubject[r.subjectId] = (day.bySubject[r.subjectId] ?? 0) + r.durationMinutes
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function pad2(n: number): string { return String(n).padStart(2, '0') }

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Returns the Monday of the week containing `date` (Mon-based week).
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()              // 0=Sun … 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMondayStr(date: Date): string {
  return toDateStr(getMondayOf(date))
}

// ── getTodayStats ─────────────────────────────────────────────────────────────

export async function getTodayStats(): Promise<DailyStats> {
  const today = toDateStr(new Date())
  const records = await getRecords(today, today)
  return (
    aggregateByDate(records)[0] ?? { date: today, totalMinutes: 0, bySubject: {} }
  )
}

// ── getWeeklyStats ────────────────────────────────────────────────────────────
// Returns Mon–Sun of the current week with per-day, per-subject breakdowns.
// Future days carry goalMinutes=0 and goalRemaining=0 (no bars displayed).

const WEEK_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const

// 変更後
export async function getWeeklyStats(
  subjects: Subject[],
  settings: AppSettings,
  weekOffset: number = 0,
): Promise<WeeklyChartData> {
  const today  = new Date()
  const todayStr = toDateStr(today)
  const monday   = getMondayOf(today)
  monday.setDate(monday.getDate() + weekOffset * 7)

  const isCurrentWeek = weekOffset === 0
  const fetchTo = isCurrentWeek
    ? todayStr
    : toDateStr(new Date(monday.getTime() + 6 * 864e5))
  const records = await getRecords(toDateStr(monday), fetchTo)

  // Build map: date → { subjectId → minutes }
  const byDate = new Map<string, Record<string, number>>()
  for (const r of records) {
    if (!byDate.has(r.date)) byDate.set(r.date, {})
    const day = byDate.get(r.date)!
    day[r.subjectId] = (day[r.subjectId] ?? 0) + r.durationMinutes
  }

  const days: WeekDayData[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr    = toDateStr(d)
// 変更後
    const isFuture   = isCurrentWeek && dateStr > todayStr
    const bySubject  = byDate.get(dateStr) ?? {}
    const totalMinutes = Object.values(bySubject).reduce((s, v) => s + v, 0)

    // weekIndex 0-4 = Mon-Fri (weekday), 5-6 = Sat-Sun (holiday)
    const isWeekend  = i >= 5
    const goalMinutes = isFuture
      ? 0
      : isWeekend
        ? settings.holidayGoalMinutes
        : settings.weekdayGoalMinutes

    days.push({
      date:          dateStr,
      label:         WEEK_LABELS[i],
      isToday:       dateStr === todayStr,
      goalMinutes,
      totalMinutes,
      goalRemaining: isFuture ? 0 : Math.max(0, goalMinutes - totalMinutes),
      bySubject,
    })
  }

  return { days, subjects }
}

// ── getRecentAverage ──────────────────────────────────────────────────────────
// Returns the average daily study minutes over the last 7 calendar days.

export async function getRecentAverage(): Promise<number> {
  const today  = new Date()
  const ago6   = new Date(today)
  ago6.setDate(today.getDate() - 6)

  const records = await getRecords(toDateStr(ago6), toDateStr(today))
  const byDate  = aggregateByDate(records)
  const total   = byDate.reduce((s, d) => s + d.totalMinutes, 0)
  return Math.round(total / 7)
}

// ── getSubjectTotals ──────────────────────────────────────────────────────────
// Returns cumulative (all-time) minutes per subject, sorted descending.
// Subjects with zero records are excluded.

export async function getSubjectTotals(subjects: Subject[]): Promise<SubjectTotal[]> {
  const d          = await getDB()
  const allRecords = (await d.getAll('records')) as StudyRecord[]

  const totalsById = new Map<string, number>()
  for (const r of allRecords) {
    if (r.durationMinutes > 0) {
      totalsById.set(r.subjectId, (totalsById.get(r.subjectId) ?? 0) + r.durationMinutes)
    }
  }

  return subjects
    .map(subject => ({ subject, totalMinutes: totalsById.get(subject.id) ?? 0 }))
    .filter(st => st.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
}

// ── getStudyStreak ────────────────────────────────────────────────────────────
// Counts consecutive days with at least 1 minute of study, going back from today.
// If today has records, it is included; otherwise counting starts from yesterday.

export async function getStudyStreak(): Promise<number> {
  const today   = new Date()
  const yearAgo = new Date(today)
  yearAgo.setFullYear(today.getFullYear() - 1)

  // Single DB call for the whole range
  const records = await getRecords(toDateStr(yearAgo), toDateStr(today))

  const studiedDates = new Set<string>()
  for (const r of records) {
    if (r.durationMinutes > 0) studiedDates.add(r.date)
  }

  const todayStr = toDateStr(today)
  const cursor   = new Date(today)

  // If today has no study yet, start counting from yesterday
  if (!studiedDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (studiedDates.has(toDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ── getDashboardStats ─────────────────────────────────────────────────────────

export async function getDashboardStats(settings: AppSettings): Promise<DashboardStats> {
  const now    = new Date()
  const today  = toDateStr(now)
  const monday = getMondayStr(now)
  const ago6   = new Date(now); ago6.setDate(now.getDate() - 6)

  const [todayRecs, weekRecs, recentRecs, streak] = await Promise.all([
    getRecords(today, today),
    getRecords(monday, today),
    getRecords(toDateStr(ago6), today),
    getStudyStreak(),
  ])

  const todayMinutes = todayRecs.reduce((s, r) => s + r.durationMinutes, 0)
  const weekMinutes  = weekRecs.reduce((s, r) => s + r.durationMinutes, 0)

  const byDate = aggregateByDate(recentRecs)
  const recentAvgMinutes =
    byDate.length > 0
      ? Math.round(byDate.reduce((s, d) => s + d.totalMinutes, 0) / 7)
      : 0

  let daysUntilTest: number | null = null
  if (settings.commonTestDate) {
    const test    = new Date(settings.commonTestDate); test.setHours(0, 0, 0, 0)
    const todayDay = new Date(now);                    todayDay.setHours(0, 0, 0, 0)
    const diff = Math.ceil((test.getTime() - todayDay.getTime()) / 864e5)
    if (diff >= 0) daysUntilTest = diff
  }

  return { todayMinutes, weekMinutes, recentAvgMinutes, daysUntilTest, streak }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  await getDB()
}

// ── Timer persistence ─────────────────────────────────────────────────────────

const RUNNING_TIMER_KEY = 'runningTimer'

export interface RunningTimerData {
  subjectId: string
  startedAt: number
}

export async function saveRunningTimer(data: RunningTimerData): Promise<void> {
  const d = await getDB()
  await d.put('settings', { key: RUNNING_TIMER_KEY, value: data })
}

export async function getRunningTimer(): Promise<RunningTimerData | null> {
  const d = await getDB()
  const entry = await d.get('settings', RUNNING_TIMER_KEY) as
    | { key: string; value: RunningTimerData }
    | undefined
  if (!entry?.value) return null
  const v = entry.value
  if (typeof v.subjectId !== 'string' || typeof v.startedAt !== 'number') return null
  if (v.startedAt > Date.now()) return null
  return v
}

export async function clearRunningTimer(): Promise<void> {
  const d = await getDB()
  await d.delete('settings', RUNNING_TIMER_KEY)
}