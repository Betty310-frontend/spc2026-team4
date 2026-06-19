# 반응형 레이아웃 컴포넌트 구현

## 파일 구조

```
src/
└── components/
    └── layout/
        ├── SplitLayout.tsx      # 루트 레이아웃 (topbar + 좌우 분할 + 면책 문구)
        ├── Topbar.tsx           # 상단 바 (로고 + 컨텍스트 칩)
        ├── ContextChip.tsx      # topbar 컨텍스트 칩
        ├── LeftPanel.tsx        # 좌측 패널 래퍼
        ├── ResizeHandle.tsx     # 좌우 패널 리사이즈 핸들
        ├── RightPanel.tsx       # 우측 에이전트 패널 래퍼
        └── index.ts             # re-export
```

---

## 레이아웃 구조 (S01 화면 기준)

```
┌─────────────────────────────────────────────────────────────┐
│ Topbar (h-9, 36px)                                          │
│ ① 로고 점 + 서비스명 | 컨텍스트 칩 (S02~S04에서 노출)         │
├──────────────────────────────────┬╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│ LeftPanel (leftWidth px)         ┊ RightPanel (나머지)      │
│                                  ↕ ResizeHandle (4px)       │
│ ② 지도 영역 (flex-1)              ┊ ④ 에이전트 헤더          │
│                                  ┊                          │
│                                  ┊ ⑤ 에이전트 첫 메시지     │
│                                  ┊                          │
│                                  ┊ ⑥ 퀵스타트 버튼 3개      │
│                                  ┊                          │
│ ③ 지표 카드 3종                   ┊ ⑦ 채팅 입력창            │
│   (동일 업종 수/경쟁 밀집도/유동인구)┊                         │
├──────────────────────────────────┴─────────────────────────┤
│ ⑧ 면책 문구 (S01에서만 노출)                                  │
└─────────────────────────────────────────────────────────────┘
```

### 너비 제약

| 항목             | 값                                          |
| ---------------- | ------------------------------------------- |
| 좌측 패널 최솟값 | `360px`                                     |
| 좌측 패널 최댓값 | `(전체 너비 - 200px)` — 우측 패널 최소 보장 |
| 우측 패널 최솟값 | `200px`                                     |
| 초기 좌측 너비   | `(전체 너비 - 280px)`                       |
| 핸들 너비        | `4px`                                       |

### 반응형 분기점

| 브레이크포인트      | 레이아웃                                       |
| ------------------- | ---------------------------------------------- |
| `lg` 이상 (≥1024px) | 좌우 분할 — 좌측 `flex-1` / 우측 `280px` 고정  |
| `md` (768px~1023px) | 좌우 분할 — 좌측 `flex-1` / 우측 `240px` 고정  |
| `sm` 이하 (< 768px) | 상하 전환 — 에이전트 패널 상단, 좌측 패널 하단 |

---

## SplitLayout.tsx

리사이즈 핸들을 포함한 루트 레이아웃. `leftWidth` 상태로 좌측 패널 너비를 제어한다.

```tsx
// src/components/layout/SplitLayout.tsx
'use client'

import { ReactNode, useRef, useState, useCallback, useEffect } from 'react'
import Topbar from './Topbar'
import ResizeHandle from './ResizeHandle'

interface SplitLayoutProps {
  topbarSlot?: ReactNode
  left: ReactNode
  right: ReactNode
  showDisclaimer?: boolean
}

const RIGHT_PANEL_MIN = 200 // 우측 패널 최솟값 (px)
const LEFT_PANEL_MIN = 360 // 좌측 패널 최솟값 (px)

export default function SplitLayout({
  topbarSlot,
  left,
  right,
  showDisclaimer = false,
}: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState<number | null>(null)
  const isDragging = useRef(false)

  // 초기 너비: 컨테이너 너비 - 280px (우측 패널 기본값)
  useEffect(() => {
    if (!containerRef.current) return
    const totalWidth = containerRef.current.offsetWidth
    setLeftWidth(totalWidth - 280)
  }, [])

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    const containerLeft = containerRef.current.getBoundingClientRect().left
    const totalWidth = containerRef.current.offsetWidth
    const newLeftWidth = e.clientX - containerLeft

    const maxLeft = totalWidth - RIGHT_PANEL_MIN
    const clamped = Math.max(LEFT_PANEL_MIN, Math.min(newLeftWidth, maxLeft))
    setLeftWidth(clamped)
  }, [])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* Topbar */}
      <Topbar>{topbarSlot}</Topbar>

      {/* 본문 */}
      <div ref={containerRef} className="flex flex-1 flex-col-reverse overflow-hidden md:flex-row">
        {/* 좌측 패널 */}
        <div
          className="min-h-[40vh] flex-shrink-0 overflow-y-auto md:min-h-0"
          style={{
            width: leftWidth != null ? `${leftWidth}px` : undefined,
            // md 미만에서는 너비 제어 해제
            flex: leftWidth == null ? '1' : undefined,
          }}
        >
          {left}
        </div>

        {/* 리사이즈 핸들 — md 이상에서만 노출 */}
        <div className="hidden md:block">
          <ResizeHandle onMouseDown={handleMouseDown} />
        </div>

        {/* 우측 에이전트 패널 */}
        <div
          className="flex min-h-[45vh] flex-1 flex-col overflow-hidden md:min-h-0"
          style={{ minWidth: `${RIGHT_PANEL_MIN}px` }}
        >
          {right}
        </div>
      </div>

      {/* 면책 문구 */}
      {showDisclaimer && (
        <div className="flex-shrink-0 border-t border-black/[0.11] bg-[#f7f7f5] px-3 py-[6px] text-[8.5px] leading-relaxed text-[#999]">
          이 서비스는 창업 리스크 해석을 위한 참고 자료를 제공합니다. 성공을 보장하지 않으며,
          재무·법률 조언이 아닙니다. 분석 결과는 공공 데이터 기준이며 실제와 다를 수 있습니다.
        </div>
      )}
    </div>
  )
}
```

---

## ResizeHandle.tsx

좌우 패널 경계의 드래그 핸들. 호버 시 파란 선으로 강조.

```tsx
// src/components/layout/ResizeHandle.tsx

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
      {/* 호버 시 잡기 쉽도록 히트 영역 확장 */}
      <div className="absolute -inset-x-[6px] inset-y-0" />
    </div>
  )
}
```

---

## Topbar.tsx

```tsx
// src/components/layout/Topbar.tsx
import { ReactNode } from 'react'

interface TopbarProps {
  children?: ReactNode
}

export default function Topbar({ children }: TopbarProps) {
  return (
    <header className="flex h-9 flex-shrink-0 items-center gap-[6px] border-b border-black/[0.11] bg-white px-3">
      {/* ① 로고 */}
      <div className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-black/20" />
      <span className="text-[11px] font-medium text-gray-900">상권 AI 진단</span>

      {/* 컨텍스트 칩 슬롯 (S02~S04) */}
      {children && <div className="ml-1 flex flex-wrap items-center gap-[5px]">{children}</div>}
    </header>
  )
}
```

---

## ContextChip.tsx

topbar 컨텍스트 칩. S02~S04에서 에이전트가 파싱한 업종·위치·반경을 표시.

```tsx
// src/components/layout/ContextChip.tsx
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
```

사용 예시:

```tsx
<Topbar>
  <ContextChip type="업종" label="☕ 카페" />
  <ContextChip type="위치" label="📍 연남동" />
  <ContextChip type="반경" label="반경 500m" />
</Topbar>
```

---

## LeftPanel.tsx

좌측 스크롤 영역 래퍼. 지도 + 지표 카드 + 리포트 + 경영 분석 순서로 쌓인다.

```tsx
// src/components/layout/LeftPanel.tsx
import { ReactNode, useRef } from 'react'

interface LeftPanelProps {
  children: ReactNode
}

export default function LeftPanel({ children }: LeftPanelProps) {
  return <div className="flex h-full flex-col gap-2 p-[10px]">{children}</div>
}

// S03에서 경영 분석 영역 앞에 삽입하는 구분선
export function AnalysisDivider() {
  return (
    <div className="mt-1 border-t border-black/[0.11] pt-2">
      <p className="mb-1 text-[7.5px] font-semibold tracking-[0.06em] text-[#999] uppercase">
        경영 분석 — 스크롤로 확인
      </p>
    </div>
  )
}

// 경영 분석 영역 하단 스크롤 힌트
export function ScrollHint() {
  return (
    <div className="flex items-center justify-center gap-1 border-t border-black/[0.11] py-1 text-[8px] text-[#999]">
      <span>↓</span>
      <span>경영 분석 영역 스크롤</span>
    </div>
  )
}
```

---

## RightPanel.tsx

우측 에이전트 패널. 헤더 + 메시지 스레드(스크롤) + 입력창(하단 고정) 구조.

```tsx
// src/components/layout/RightPanel.tsx
import { ReactNode } from 'react'

export type AgentStatus = 'idle' | 'analyzing' | 'done' | 'chatting'

const STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string }> = {
  idle: { label: '대기 중', dotColor: '#639922' },
  analyzing: { label: '분석 중', dotColor: '#BA7517' },
  done: { label: '분석 완료', dotColor: '#639922' },
  chatting: { label: '대화 중', dotColor: '#639922' },
}

interface RightPanelProps {
  status: AgentStatus
  messages: ReactNode
  input: ReactNode
}

export default function RightPanel({ status, messages, input }: RightPanelProps) {
  const { label, dotColor } = STATUS_CONFIG[status]

  return (
    <div className="flex h-full flex-col px-[10px] pt-[10px]">
      {/* ④ 에이전트 헤더 */}
      <div className="mb-2 flex flex-shrink-0 items-center justify-between border-b border-black/[0.11] pb-[6px]">
        <span className="text-[10px] font-medium text-gray-900">AI 에이전트</span>
        <span className="flex items-center gap-[3px] text-[9px] text-[#999]">
          <span
            className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
            style={{ background: dotColor }}
          />
          {label}
        </span>
      </div>

      {/* ⑤⑥ 메시지 스레드 — 스크롤 */}
      <div className="flex flex-1 flex-col gap-[5px] overflow-y-auto pb-2">{messages}</div>

      {/* ⑦ 채팅 입력창 — 하단 고정 */}
      <div className="flex-shrink-0 border-t border-black/[0.11] pt-[5px] pb-[10px]">{input}</div>
    </div>
  )
}
```

---

## index.ts

```ts
// src/components/layout/index.ts
export { default as SplitLayout } from './SplitLayout'
export { default as Topbar } from './Topbar'
export { default as ContextChip } from './ContextChip'
export { default as LeftPanel } from './LeftPanel'
export { AnalysisDivider, ScrollHint } from './LeftPanel'
export { default as ResizeHandle } from './ResizeHandle'
export { default as RightPanel } from './RightPanel'
export type { AgentStatus } from './RightPanel'
```

---

## 사용 예시 — S01 랜딩

```tsx
// app/page.tsx
import {
  SplitLayout,
  LeftPanel,
  RightPanel,
} from '@/components/layout'

export default function LandingPage() {
  return (
    <SplitLayout
      // topbarSlot 없음 — S01은 칩 미노출
      showDisclaimer={true}
      left={
        <LeftPanel>
          <KakaoMap />        {/* ② 지도 — flex-1로 높이 채움 */}
          <MetricCards />     {/* ③ 지표 카드 3종 */}
        </LeftPanel>
      }
      right={
        <RightPanel
          status="idle"
          messages={
            <>
              <AgentMessage />    {/* ⑤ 첫 메시지 */}
              <QuickStartBtns />  {/* ⑥ 퀵스타트 버튼 */}
            </>
          }
          input={<ChatInput />}   {/* ⑦ 입력창 */}
        />
      }
    />
  )
}
```

---

## 구현 시 주의사항

1. **`h-screen` + `overflow-hidden`** 조합 필수. 스크롤은 `LeftPanel` 내부와 `RightPanel` 메시지 스레드 내부에서만 발생해야 한다.

2. **리사이즈 핸들은 `md` 이상에서만 노출.** 모바일(`sm` 이하)에서는 상하 전환 레이아웃으로 핸들 불필요.

3. **드래그 중 텍스트 선택 방지.** `mousedown` 시 `document.body.style.userSelect = 'none'`, `mouseup` 시 복원. 이 처리 없으면 드래그 중 텍스트가 선택돼 UX가 깨진다.

4. **드래그 중 커서 고정.** `document.body.style.cursor = 'col-resize'`로 마우스가 핸들 밖으로 벗어나도 커서 모양 유지.

5. **너비 clamp.** 좌측 최솟값 `360px`, 우측 최솟값 `200px`. 두 값 합이 전체 너비를 초과하지 않도록 `Math.max / Math.min`으로 제어.

6. **초기 너비 계산.** `useEffect`에서 `containerRef.current.offsetWidth`로 실제 DOM 너비 기준 계산. SSR 환경에서 `null`로 초기화 후 클라이언트에서 설정.

7. **모바일(`sm` 이하) 방향 전환.** `flex-col-reverse`로 에이전트 패널 상단, 지도 패널 하단. 모바일 키보드가 올라왔을 때 입력창이 키보드 바로 위에 위치하도록 한다.

8. **`ResizeHandle` 히트 영역.** 핸들 자체는 `4px`로 좁지만, 내부 `absolute` div로 좌우 `6px`씩 히트 영역 확장. 클릭하기 쉽게.

9. **`ContextChip` 색상.** `CHIP_COLORS`는 `src/styles/colors.ts`에서 import. 업종 칩은 카카오 옐로우 계열, 위치 칩은 Indigo 계열 적용.
