interface ResizeHandleProps {
  onMouseDown: () => void
}

export default function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative h-full w-[4px] flex-shrink-0 cursor-col-resize bg-black/[0.11] transition-colors duration-150 hover:bg-[#5C5FC4]"
      role="separator"
      aria-orientation="vertical"
      aria-label="패널 너비 조절"
    >
      {/* 히트 영역 확장 — 핸들 좌우 6px */}
      <div className="absolute -inset-x-[6px] inset-y-0" />
    </div>
  )
}
