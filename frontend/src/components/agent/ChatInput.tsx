'use client'

import { KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
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
      if (!disabled) onSend()
    }
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-t px-3 pt-3 pb-3">
      <Input
        data-chat-input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? '분석 중…' : (placeholder ?? '업종과 위치를 입력하세요…')}
        disabled={disabled}
        className={cn(
          'flex-1 text-sm',
          disabled && 'placeholder:text-muted-foreground/50 cursor-not-allowed opacity-60',
        )}
      />
      <Button
        size="icon-sm"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={cn(disabled && 'cursor-not-allowed opacity-40')}
        aria-label="전송"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
