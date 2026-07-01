import { Providers } from './providers'
import './globals.css'
import { cn } from '@/lib/utils'

export const metadata = {
  title: '상권 분석 AI',
  description: '상권 분석 AI로 경쟁, 생활인구, 리포트를 확인합니다.',
}

const fontVariables = {
  '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
  '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as React.CSSProperties

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn('h-full font-sans')} style={fontVariables}>
      <body className="h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
