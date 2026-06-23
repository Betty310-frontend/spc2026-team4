'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, lazy, Suspense } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AnalysisContextProvider } from '@/store/analysisContext'
import { AnalysisResultProvider } from '@/store/analysisResult'

const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
)

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, refetchOnWindowFocus: false },
        },
      }),
  )

  const isDevtools =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

  return (
    <AnalysisResultProvider>
      <AnalysisContextProvider>
        <ThemeProvider>
          <TooltipProvider>
            <QueryClientProvider client={queryClient}>
              {children}
              {isDevtools && (
                <Suspense fallback={null}>
                  <ReactQueryDevtools initialIsOpen={false} />
                </Suspense>
              )}
            </QueryClientProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AnalysisContextProvider>
    </AnalysisResultProvider>
  )
}
