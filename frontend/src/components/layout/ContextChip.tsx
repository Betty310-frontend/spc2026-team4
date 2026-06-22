interface ContextChipProps {
  label: string
  dotColor?: string
}

export default function ContextChip({ label, dotColor }: ContextChipProps) {
  return (
    <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap">
      {dotColor && (
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: dotColor }} />
      )}
      {label}
    </span>
  )
}
