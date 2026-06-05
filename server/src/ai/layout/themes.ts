export type DiagramTheme = 'minimal' | 'default' | 'vibrant'

export interface ThemeConfig {
  palette:           string[]
  strokeColor:       string
  strokeWidth:       number
  arrowColor:        string
  arrowStrokeWidth:  number
  groupOpacity:      number
}

export const THEMES: Record<DiagramTheme, ThemeConfig> = {
  minimal: {
    palette:          ['transparent', '#f8fafc', '#f1f5f9', 'transparent', '#f0fdf4', '#eff6ff'],
    strokeColor:      '#94a3b8',
    strokeWidth:      1,
    arrowColor:       '#94a3b8',
    arrowStrokeWidth: 1,
    groupOpacity:     15,
  },
  default: {
    palette:          ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe', '#ffedd5', '#e0f2fe'],
    strokeColor:      '#1e1e1e',
    strokeWidth:      1.5,
    arrowColor:       '#1e1e1e',
    arrowStrokeWidth: 1.5,
    groupOpacity:     40,
  },
  vibrant: {
    palette:          ['#bfdbfe', '#bbf7d0', '#fde68a', '#fbcfe8', '#ddd6fe', '#fed7aa', '#bae6fd'],
    strokeColor:      '#0f172a',
    strokeWidth:      2,
    arrowColor:       '#334155',
    arrowStrokeWidth: 2,
    groupOpacity:     55,
  },
}

export const DEFAULT_THEME: DiagramTheme = 'default'
