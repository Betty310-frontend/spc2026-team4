import type { AgentMessage } from '@/types/message'

export const INITIAL_MESSAGE: AgentMessage = {
  id: 'init',
  role: 'agent',
  content:
    '안녕하세요! 창업을 준비 중이신가요?\n업종과 후보 위치를 알려주시면 반경 내 경쟁 현황, 유동인구, 리스크를 분석해드릴게요.\n\n현재 위치를 사용하시겠어요?',
  confirmButtons: [
    { label: '📍 현재 위치 사용', variant: 'outline', action: 'use_current_location' },
    { label: '직접 입력할게요', variant: 'outline', action: 'input_manually' },
  ],
}
