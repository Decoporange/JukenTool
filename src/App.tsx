import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import type { TabId, TimerState, TimerContextType } from './types'
import {
  addRecord,
  saveRunningTimer,
  getRunningTimer,
  clearRunningTimer,
  getSubjects,
} from './db'
import { MIN_TIMER_SECONDS } from './constants'
import Navigation from './Navigation'
import Dashboard from './Dashboard'
import Timer from './Timer'
import Charts from './Charts'
import Subjects from './Subjects'
import Settings from './Settings'

// ── Timer Context ─────────────────────────────────────────────────────────────

const TIMER_INITIAL: TimerState = {
  isRunning:      false,
  subjectId:      null,
  startedAt:      null,
  elapsedSeconds: 0,
}

export const TimerContext = createContext<TimerContextType | null>(null)

export function useTimer(): TimerContextType {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used inside TimerContext.Provider')
  return ctx
}

// ── Slide direction ───────────────────────────────────────────────────────────

type SlideDir = 'right' | 'left' | 'initial'

const TAB_ORDER: TabId[] = ['dashboard', 'timer', 'charts', 'subjects', 'settings']

function calcDir(from: TabId, to: TabId): SlideDir {
  return TAB_ORDER.indexOf(to) > TAB_ORDER.indexOf(from) ? 'right' : 'left'
}

function animClass(dir: SlideDir): string {
  if (dir === 'right') return 'screen-slide-right'
  if (dir === 'left')  return 'screen-slide-left'
  return 'screen-enter'
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── SW Update Banner ──────────────────────────────────────────────────────────

interface UpdateBannerProps {
  onUpdate: () => void
  onClose: () => void
}

function UpdateBanner({ onUpdate, onClose }: UpdateBannerProps) {
  return (
    <div className="sw-update-banner" role="status" aria-live="polite">
      <span className="sw-update-text">アプリの新しいバージョンがあります</span>
      <div className="sw-update-actions">
        <button type="button" className="btn btn-text sw-update-btn-close" onClick={onClose}>
          後で
        </button>
        <button type="button" className="btn sw-update-btn-apply" onClick={onUpdate}>
          更新する
        </button>
      </div>
    </div>
  )
}

// ── Install Banner ────────────────────────────────────────────────────────────
// Uses beforeinstallprompt. Re-shown after 7 days if dismissed.

const INSTALL_DISMISSED_KEY = 'installBannerDismissedAt'
const INSTALL_COOLDOWN_MS   = 7 * 24 * 60 * 60 * 1000   // 7 days

function shouldShowInstallBanner(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISSED_KEY)
    if (!raw) return true
    return Date.now() - parseInt(raw, 10) > INSTALL_COOLDOWN_MS
  } catch {
    return false
  }
}

function dismissInstallBanner() {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
  } catch {
    // localStorage blocked (private mode) — just suppress without crashing
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallBannerProps {
  onInstall: () => void
  onClose: () => void
}

function InstallBanner({ onInstall, onClose }: InstallBannerProps) {
  return (
    <div className="install-banner" role="complementary" aria-label="ホーム画面に追加">
      <div className="install-banner-body">
        <div className="install-banner-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-8 9z"/>
          </svg>
        </div>
        <div className="install-banner-text">
          <span className="install-banner-title">ホーム画面に追加</span>
          <span className="install-banner-desc">オフラインでも使えます</span>
        </div>
      </div>
      <div className="install-banner-actions">
        <button
          type="button"
          className="btn btn-text install-banner-btn-close"
          onClick={onClose}
          aria-label="案内を閉じる"
        >
          後で
        </button>
        <button
          type="button"
          className="btn install-banner-btn-add"
          onClick={onInstall}
        >
          追加する
        </button>
      </div>
    </div>
  )
}

// ── First-run overlay ─────────────────────────────────────────────────────────
// Shown when the app has zero subjects registered.

interface FirstRunOverlayProps {
  onGo: () => void
}

function FirstRunOverlay({ onGo }: FirstRunOverlayProps) {
  return (
    <div className="first-run-overlay">
      <div className="first-run-card">
        <div className="first-run-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <h1 className="first-run-title">学習タイマーへようこそ</h1>
        <p className="first-run-body">
          まず教科を登録してください。<br />
          登録後すぐにタイマーで記録を始められます。
        </p>
        <button type="button" className="btn btn-filled first-run-btn" onClick={onGo}>
          教科を追加する
        </button>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [currentTab,   setCurrentTab]   = useState<TabId>('dashboard')
  const [slideDir,     setSlideDir]     = useState<SlideDir>('initial')
  const [animKey,      setAnimKey]      = useState(0)
  const [timerState,   setTimerState]   = useState<TimerState>(TIMER_INITIAL)
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [installEvt,   setInstallEvt]   = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall,  setShowInstall]  = useState(false)
  const [showUpdate,   setShowUpdate]   = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Service Worker update detection ────────────────────────────────────────

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setShowUpdate(true)
    },
    onOfflineReady() {
      // App is cached and ready to work offline — no UI needed
    },
  })

  const handleUpdate = useCallback(() => {
    setShowUpdate(false)
    updateServiceWorker(true)
  }, [updateServiceWorker])

  // ── Install prompt (Android Chrome beforeinstallprompt) ────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      if (shouldShowInstallBanner()) {
        setInstallEvt(e as BeforeInstallPromptEvent)
        setShowInstall(true)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!installEvt) return
    setShowInstall(false)
    await installEvt.prompt()
    const { outcome } = await installEvt.userChoice
    if (outcome === 'accepted') {
      dismissInstallBanner()
    }
    setInstallEvt(null)
  }, [installEvt])

  const handleInstallClose = useCallback(() => {
    setShowInstall(false)
    dismissInstallBanner()
    setInstallEvt(null)
  }, [])

  // ── First-run: check for zero subjects ────────────────────────────────────

  useEffect(() => {
    getSubjects()
      .then(subs => { if (subs.length === 0) setShowFirstRun(true) })
      .catch(console.error)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstRunGo = useCallback(() => {
    setShowFirstRun(false)
    setSlideDir(calcDir(currentTab, 'subjects'))
    setCurrentTab('subjects')
    setAnimKey(k => k + 1)
  }, [currentTab])

  // ── Restore timer on mount ─────────────────────────────────────────────────

  useEffect(() => {
    const restore = async () => {
      try {
        const saved = await getRunningTimer()
        if (saved) {
          setTimerState({
            isRunning:      true,
            subjectId:      saved.subjectId,
            startedAt:      saved.startedAt,
            elapsedSeconds: Math.floor((Date.now() - saved.startedAt) / 1000),
          })
        }
      } catch (err) {
        console.error('Timer restore failed:', err)
      }
    }
    restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer tick (wall-clock based — no simple counter increment) ────────────

  useEffect(() => {
    if (!timerState.isRunning || timerState.startedAt === null) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    const t0 = timerState.startedAt
    intervalRef.current = setInterval(() => {
      setTimerState(prev => ({
        ...prev,
        elapsedSeconds: Math.floor((Date.now() - t0) / 1000),
      }))
    }, 1000)
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerState.isRunning, timerState.startedAt])

  // ── Timer actions ──────────────────────────────────────────────────────────

  const startTimer = useCallback((subjectId: string) => {
    const startedAt = Date.now()
    setTimerState({ isRunning: true, subjectId, startedAt, elapsedSeconds: 0 })
    saveRunningTimer({ subjectId, startedAt }).catch(console.error)
    // Hide first-run overlay if user starts a timer after adding subjects
    setShowFirstRun(false)
  }, [])

  const stopTimer = useCallback(async () => {
    clearRunningTimer().catch(console.error)
    const { subjectId, startedAt, elapsedSeconds } = timerState
    if (!subjectId || startedAt === null) { setTimerState(TIMER_INITIAL); return }
    if (elapsedSeconds >= MIN_TIMER_SECONDS) {
      try {
        await addRecord({
          subjectId,
          durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
          date: todayStr(), startedAt, endedAt: Date.now(), type: 'timer',
        })
      } catch (err) {
        console.error('Record save failed:', err)
      }
    }
    setTimerState(TIMER_INITIAL)
  }, [timerState])

  const resetTimer = useCallback(() => {
    clearRunningTimer().catch(console.error)
    setTimerState(TIMER_INITIAL)
  }, [])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleTabChange = useCallback((id: TabId) => {
    if (id === currentTab) return
    // When user navigates to subjects and adds one, hide first-run overlay
    if (id === 'subjects') setShowFirstRun(false)
    setSlideDir(calcDir(currentTab, id))
    setCurrentTab(id)
    setAnimKey(k => k + 1)
  }, [currentTab])

  // ── Screen render ──────────────────────────────────────────────────────────

  const renderScreen = () => {
    switch (currentTab) {
      case 'dashboard': return <Dashboard onNavigate={handleTabChange} />
      case 'timer':     return <Timer />
      case 'charts':    return <Charts />
      case 'subjects':  return <Subjects onFirstSubjectAdded={() => setShowFirstRun(false)} />
      case 'settings':  return <Settings />
    }
  }

  return (
    <TimerContext.Provider value={{ timerState, startTimer, stopTimer, resetTimer }}>
      <div className="app">

        {/* SW update notification */}
        {showUpdate && (
          <UpdateBanner
            onUpdate={handleUpdate}
            onClose={() => setShowUpdate(false)}
          />
        )}

        {/* Install prompt banner */}
        {showInstall && installEvt && (
          <InstallBanner
            onInstall={handleInstall}
            onClose={handleInstallClose}
          />
        )}

        <main className="main-content">
          <div key={animKey} className={animClass(slideDir)}>
            {renderScreen()}
          </div>
        </main>

        <Navigation
          currentTab={currentTab}
          onTabChange={handleTabChange}
          isTimerRunning={timerState.isRunning}
        />

        {/* First-run overlay — rendered above everything else */}
        {showFirstRun && <FirstRunOverlay onGo={handleFirstRunGo} />}
      </div>
    </TimerContext.Provider>
  )
}