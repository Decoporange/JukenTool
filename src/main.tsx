import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { initDB } from './db'

// ── Error screen (shown when IndexedDB fails to initialize) ───────────────────
// Rendered as raw HTML so it works even if React itself has a problem.

function showFatalError(err: unknown) {
  console.error('App failed to start:', err)
  const el = document.getElementById('root')
  if (!el) return

  const isStorageError =
    err instanceof DOMException &&
    (err.name === 'SecurityError' || err.name === 'InvalidStateError')

  const message = isStorageError
    ? 'ストレージへのアクセスが拒否されました。\nプライベートブラウズモードではご利用いただけません。'
    : 'データベースの起動に失敗しました。\nページを再読み込みしてください。'

  el.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;padding:32px;text-align:center;
      font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans',system-ui,sans-serif;
      background:#F5F7FA;color:#1A1C1E;
    ">
      <svg viewBox="0 0 24 24" width="52" height="52" fill="#BA1A1A" style="margin-bottom:20px">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <p style="font-size:18px;font-weight:700;margin-bottom:10px;white-space:pre-line">${message}</p>
      <p style="font-size:13px;color:#73777F;margin-bottom:28px">
        問題が続く場合はブラウザのキャッシュをクリアしてください
      </p>
      <button
        onclick="window.location.reload()"
        style="
          background:#1565C0;color:#fff;border:none;border-radius:9999px;
          padding:14px 32px;font-size:15px;font-weight:600;cursor:pointer;
          font-family:inherit;
        "
      >再読み込み</button>
    </div>
  `
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function bootstrap() {
  await initDB()
  const el = document.getElementById('root')!
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

bootstrap().catch(showFatalError)

