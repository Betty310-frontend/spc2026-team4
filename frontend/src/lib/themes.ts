export type ThemeName = 'neutral' | 'blue' | 'violet' | 'emerald' | 'rose' | 'kakao';
export type ThemeMode = 'light' | 'dark';

type CSSVars = Record<string, string>;

interface ThemePalette {
  light: CSSVars;
  dark: CSSVars;
  swatch: string; // CSS color for the swatch button
  label: string;
}

export const themes: Record<ThemeName, ThemePalette> = {
  neutral: {
    label: 'Neutral',
    swatch: '#71717a',
    light: {
      '--primary': '#18181b',
      '--primary-foreground': '#ffffff',
      '--ring': '#a1a1aa',
      '--sidebar-primary': '#18181b',
      '--sidebar-primary-foreground': '#ffffff',
    },
    dark: {
      '--primary': '#f4f4f5',
      '--primary-foreground': '#18181b',
      '--ring': '#71717a',
      '--sidebar-primary': '#5c5fc4',
      '--sidebar-primary-foreground': '#ffffff',
    },
  },
  blue: {
    label: 'Blue',
    swatch: '#5c5fc4',
    light: {
      '--primary': '#5c5fc4',
      '--primary-foreground': '#ffffff',
      '--ring': '#5c5fc4',
      '--sidebar-primary': '#5c5fc4',
      '--sidebar-primary-foreground': '#ffffff',
    },
    dark: {
      '--primary': '#9b9eec',
      '--primary-foreground': '#18181b',
      '--ring': '#9b9eec',
      '--sidebar-primary': '#5c5fc4',
      '--sidebar-primary-foreground': '#ffffff',
    },
  },
  violet: {
    label: 'Violet',
    swatch: '#7c3aed',
    light: {
      '--primary': '#7c3aed',
      '--primary-foreground': '#ffffff',
      '--ring': '#7c3aed',
      '--sidebar-primary': '#7c3aed',
      '--sidebar-primary-foreground': '#ffffff',
    },
    dark: {
      '--primary': '#a78bfa',
      '--primary-foreground': '#18181b',
      '--ring': '#a78bfa',
      '--sidebar-primary': '#7c3aed',
      '--sidebar-primary-foreground': '#ffffff',
    },
  },
  emerald: {
    label: 'Emerald',
    swatch: '#10b981',
    light: {
      '--primary': '#10b981',
      '--primary-foreground': '#ffffff',
      '--ring': '#10b981',
      '--sidebar-primary': '#10b981',
      '--sidebar-primary-foreground': '#ffffff',
    },
    dark: {
      '--primary': '#34d399',
      '--primary-foreground': '#18181b',
      '--ring': '#34d399',
      '--sidebar-primary': '#10b981',
      '--sidebar-primary-foreground': '#ffffff',
    },
  },
  rose: {
    label: 'Rose',
    swatch: '#f43f5e',
    light: {
      '--primary': '#f43f5e',
      '--primary-foreground': '#ffffff',
      '--ring': '#f43f5e',
      '--sidebar-primary': '#f43f5e',
      '--sidebar-primary-foreground': '#ffffff',
    },
    dark: {
      '--primary': '#fb7185',
      '--primary-foreground': '#18181b',
      '--ring': '#fb7185',
      '--sidebar-primary': '#f43f5e',
      '--sidebar-primary-foreground': '#ffffff',
    },
  },
  kakao: {
    label: 'Kakao',
    swatch: '#ffe812',                   /* YELLOW[200] #FFE812 */
    light: {
      '--primary': '#ffe812',             /* YELLOW[200] #FFE812 */
      '--primary-foreground': '#4a4200', /* YELLOW[900] #4A4200 */
      '--ring': '#5c5fc4',                /* INDIGO[400] #5C5FC4 */
      '--sidebar-primary': '#ffe812',
      '--sidebar-primary-foreground': '#4a4200',
    },
    dark: {
      '--primary': '#ffe812',             /* YELLOW[200] — 다크에서도 동일 */
      '--primary-foreground': '#4a4200', /* 다크 배경용 더 진한 텍스트 */
      '--ring': '#8b8ef0',                /* INDIGO 계열 밝게 */
      '--sidebar-primary': '#ffe812',
      '--sidebar-primary-foreground': '#4a4200',
    },
  },
};

export const THEME_NAMES = Object.keys(themes) as ThemeName[];
