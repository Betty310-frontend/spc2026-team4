'use client'

import { KeyboardEvent, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t px-3 pb-3 pt-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="업종과 위치를 입력하세요…"
        disabled={disabled}
        className="flex-1 text-sm"
      />
      <Button
        size="icon-sm"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="전송"
      >
        <ArrowUp />
      </Button>
    </div>
  )
}
