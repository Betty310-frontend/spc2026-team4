'use client';

import { Check, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { themes, THEME_NAMES } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col items-start gap-2">
      <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-lg">
        <span className="text-xs font-medium text-muted-foreground mr-1">Theme</span>
        {THEME_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setTheme(name)}
            title={themes[name].label}
            className={cn(
              'relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              theme === name && 'ring-2 ring-offset-2 ring-ring ring-offset-card'
            )}
            style={{ background: themes[name].swatch }}
          >
            {theme === name && (
              <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow" />
            )}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          className="h-7 w-7 p-0"
          aria-label="Toggle dark mode"
        >
          {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
