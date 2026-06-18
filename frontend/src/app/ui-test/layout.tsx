import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeSwitcher } from '@/components/ui-test/theme-switcher';

export default function UITestLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <ThemeSwitcher />
      </TooltipProvider>
    </ThemeProvider>
  );
}
