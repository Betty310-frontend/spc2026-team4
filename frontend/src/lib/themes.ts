export type ThemeName = 'neutral' | 'blue' | 'violet' | 'emerald' | 'rose';
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
    swatch: 'oklch(0.556 0 0)',
    light: {
      '--primary': 'oklch(0.205 0 0)',
      '--primary-foreground': 'oklch(0.985 0 0)',
      '--ring': 'oklch(0.708 0 0)',
      '--sidebar-primary': 'oklch(0.205 0 0)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.922 0 0)',
      '--primary-foreground': 'oklch(0.205 0 0)',
      '--ring': 'oklch(0.556 0 0)',
      '--sidebar-primary': 'oklch(0.488 0.243 264.376)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
  },
  blue: {
    label: 'Blue',
    swatch: 'oklch(0.546 0.245 262.881)',
    light: {
      '--primary': 'oklch(0.546 0.245 262.881)',
      '--primary-foreground': 'oklch(0.985 0 0)',
      '--ring': 'oklch(0.546 0.245 262.881)',
      '--sidebar-primary': 'oklch(0.546 0.245 262.881)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.707 0.165 254.624)',
      '--primary-foreground': 'oklch(0.145 0 0)',
      '--ring': 'oklch(0.707 0.165 254.624)',
      '--sidebar-primary': 'oklch(0.546 0.245 262.881)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
  },
  violet: {
    label: 'Violet',
    swatch: 'oklch(0.491 0.27 278.34)',
    light: {
      '--primary': 'oklch(0.491 0.27 278.34)',
      '--primary-foreground': 'oklch(0.985 0 0)',
      '--ring': 'oklch(0.491 0.27 278.34)',
      '--sidebar-primary': 'oklch(0.491 0.27 278.34)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.702 0.183 276.935)',
      '--primary-foreground': 'oklch(0.145 0 0)',
      '--ring': 'oklch(0.702 0.183 276.935)',
      '--sidebar-primary': 'oklch(0.491 0.27 278.34)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
  },
  emerald: {
    label: 'Emerald',
    swatch: 'oklch(0.528 0.148 160.99)',
    light: {
      '--primary': 'oklch(0.528 0.148 160.99)',
      '--primary-foreground': 'oklch(0.985 0 0)',
      '--ring': 'oklch(0.528 0.148 160.99)',
      '--sidebar-primary': 'oklch(0.528 0.148 160.99)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.696 0.17 162.48)',
      '--primary-foreground': 'oklch(0.145 0 0)',
      '--ring': 'oklch(0.696 0.17 162.48)',
      '--sidebar-primary': 'oklch(0.528 0.148 160.99)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
  },
  rose: {
    label: 'Rose',
    swatch: 'oklch(0.576 0.215 22.52)',
    light: {
      '--primary': 'oklch(0.576 0.215 22.52)',
      '--primary-foreground': 'oklch(0.985 0 0)',
      '--ring': 'oklch(0.576 0.215 22.52)',
      '--sidebar-primary': 'oklch(0.576 0.215 22.52)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
    dark: {
      '--primary': 'oklch(0.712 0.194 22.652)',
      '--primary-foreground': 'oklch(0.145 0 0)',
      '--ring': 'oklch(0.712 0.194 22.652)',
      '--sidebar-primary': 'oklch(0.576 0.215 22.52)',
      '--sidebar-primary-foreground': 'oklch(0.985 0 0)',
    },
  },
};

export const THEME_NAMES = Object.keys(themes) as ThemeName[];
