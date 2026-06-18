'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { themes, THEME_NAMES, type ThemeName, type ThemeMode } from '@/lib/themes';

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'neutral'; // SSR 대비
    const saved = localStorage.getItem('ui-theme') as ThemeName | null;
    return saved && THEME_NAMES.includes(saved) ? saved : 'neutral';
  });
  const [modeState, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('ui-mode') as ThemeMode | null;
    return saved === 'light' || saved === 'dark' ? saved : 'light';
  });
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    const palette = themes[themeState][modeState];
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    document.documentElement.classList.toggle('dark', modeState === 'dark');
  }, [themeState, modeState]);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    localStorage.setItem('ui-theme', next);
  };

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem('ui-mode', next);
  };

  const toggleMode = () => setMode(modeState === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme: themeState, mode: modeState, setTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
