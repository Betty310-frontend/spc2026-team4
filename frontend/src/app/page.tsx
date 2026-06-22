import { SplitLayout, LeftPanel, RightPanel } from '@/components/layout'
import { KakaoMap } from '@/components/map/KakaoMap'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { TEXT_MUTED } from '@/styles/colors'

export default function Home() {
  return (
    <SplitLayout
      showDisclaimer={true}
      left={
        <LeftPanel>
          <KakaoMap />
        </LeftPanel>
      }
      right={
        <RightPanel
          status="idle"
          messages={
            <p className="text-[11px]" style={{ color: TEXT_MUTED }}>
              안녕하세요! 상권 분석을 시작하려면 업종과 위치를 알려주세요.
            </p>
          }
          input={<ChatPanel />}
        />
      }
    />
  )
}
