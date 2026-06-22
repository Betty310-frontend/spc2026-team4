import { ThemeSwitcher } from '@/components/ui-test/theme-switcher';

export default function UITestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ThemeSwitcher />
    </>
  );
}
