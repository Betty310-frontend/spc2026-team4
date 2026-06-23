'use client'

import { KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ value, onChange, onSend, disabled, placeholder }: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t px-3 pb-3 pt-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '업종과 위치를 입력하세요…'}
        disabled={disabled}
        className="flex-1 text-sm"
      />
      <Button
        size="icon-sm"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="전송"
      >
        <ArrowUp />
      </Button>
    </div>
  )
}
