import { Providers } from './providers'
import './globals.css'
import { cn } from '@/lib/utils'

const fontVariables = {
  '--font-sans': 'ui-sans-serif, system-ui, sans-serif',
  '--font-geist-mono': 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as React.CSSProperties


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={cn('font-sans')} style={fontVariables}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
