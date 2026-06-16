'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  const [theme, setThemeState] = useState<ThemeName>('neutral');
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ui-theme') as ThemeName | null;
    const savedMode = localStorage.getItem('ui-mode') as ThemeMode | null;
    if (savedTheme && THEME_NAMES.includes(savedTheme)) setThemeState(savedTheme);
    if (savedMode === 'light' || savedMode === 'dark') setModeState(savedMode);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const palette = themes[theme][mode];
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [theme, mode, mounted]);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    localStorage.setItem('ui-theme', next);
  };

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem('ui-mode', next);
  };

  const toggleMode = () => setMode(mode === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
