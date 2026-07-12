// theme.ts
// Recharts などの JS コンテキストで使うカラートークン。
// 値は styles.css の :root / @media (prefers-color-scheme: dark) と一致させる。

export const lightTokens = {
  // ── Primary ──────────────────────────────────────────────────────────
  primary:                '#1565C0',
  onPrimary:              '#FFFFFF',
  primaryContainer:       '#D6E4FF',
  onPrimaryContainer:     '#001945',
  inversePrimary:         '#A8C7FA',

  // ── Secondary ─────────────────────────────────────────────────────────
  secondary:              '#535F70',
  onSecondary:            '#FFFFFF',
  secondaryContainer:     '#D7E3F7',
  onSecondaryContainer:   '#101C2B',

  // ── Error ─────────────────────────────────────────────────────────────
  error:                  '#BA1A1A',
  onError:                '#FFFFFF',
  errorContainer:         '#FFDAD6',
  onErrorContainer:       '#410002',

  // ── Background / Surface ──────────────────────────────────────────────
  background:             '#F5F7FA',
  onBackground:           '#1A1C1E',
  surface:                '#F5F7FA',
  onSurface:              '#1A1C1E',
  surfaceVariant:         '#DFE4EC',
  onSurfaceVariant:       '#43474E',
  inverseSurface:         '#2F3033',
  inverseOnSurface:       '#F1F0F4',

  // ── Surface containers ────────────────────────────────────────────────
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow:    '#F0F3F9',
  surfaceContainer:       '#EBF0F5',
  surfaceContainerHigh:   '#E5EAF0',
  surfaceContainerHighest:'#DFE4EC',

  // ── Outline ───────────────────────────────────────────────────────────
  outline:                '#73777F',
  outlineVariant:         '#C3C7CF',
} as const

export const darkTokens = {
  // ── Primary ──────────────────────────────────────────────────────────
  primary:                '#A8C7FA',
  onPrimary:              '#002F67',
  primaryContainer:       '#004199',
  onPrimaryContainer:     '#D6E4FF',
  inversePrimary:         '#1565C0',

  // ── Secondary ─────────────────────────────────────────────────────────
  secondary:              '#BBC7DB',
  onSecondary:            '#253140',
  secondaryContainer:     '#3B4858',
  onSecondaryContainer:   '#D7E3F7',

  // ── Error ─────────────────────────────────────────────────────────────
  error:                  '#FFB4AB',
  onError:                '#690005',
  errorContainer:         '#93000A',
  onErrorContainer:       '#FFDAD6',

  // ── Background / Surface ──────────────────────────────────────────────
  background:             '#0D1117',
  onBackground:           '#E2E2E6',
  surface:                '#0D1117',
  onSurface:              '#E2E2E6',
  surfaceVariant:         '#43474E',
  onSurfaceVariant:       '#C3C7CF',
  inverseSurface:         '#E2E2E6',
  inverseOnSurface:       '#2F3033',

  // ── Surface containers ────────────────────────────────────────────────
  surfaceContainerLowest: '#0C0F12',
  surfaceContainerLow:    '#1A1C1E',
  surfaceContainer:       '#1E2124',
  surfaceContainerHigh:   '#282B2E',
  surfaceContainerHighest:'#333639',

  // ── Outline ───────────────────────────────────────────────────────────
  outline:                '#8D9199',
  outlineVariant:         '#43474E',
} as const

// 修正後（これに書き換える！）
export type ThemeTokens = Record<string, string>

export function getTokens(): ThemeTokens {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? (darkTokens as unknown as ThemeTokens)
    : (lightTokens as unknown as ThemeTokens)
}