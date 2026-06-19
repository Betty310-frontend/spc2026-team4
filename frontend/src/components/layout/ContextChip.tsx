import { CHIP_COLORS } from '@/styles/colors'

type ChipType = '업종' | '위치' | '반경'

interface ContextChipProps {
  type: ChipType
  label: string
}

export default function ContextChip({ type, label }: ContextChipProps) {
  const color = CHIP_COLORS[type]

  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full border px-[7px] py-[2px] text-[9.5px] whitespace-nowrap"
      style={{
        background: color.bg,
        borderColor: color.border,
        color: '#555',
      }}
    >
      {color.dot && (
        <span
          className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
          style={{ background: color.dot }}
        />
      )}
      {label}
    </span>
  )
}
