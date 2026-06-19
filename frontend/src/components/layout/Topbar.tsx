import { ReactNode } from 'react'

interface TopbarProps {
  children?: ReactNode
}

export default function Topbar({ children }: TopbarProps) {
  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-[6px] border-b border-black/[0.11] bg-white px-3">
      <div className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-black/20" />
      <span className="text-[11px] font-medium text-gray-900">상권 AI 진단</span>

      {children && <div className="ml-1 flex flex-wrap items-center gap-[5px]">{children}</div>}
    </header>
  )
}
