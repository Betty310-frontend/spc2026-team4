import { ChatMessage } from '@/types/message'

export const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'agent',
    content:
      '안녕하세요! 창업을 준비 중이신가요?\n업종과 후보 위치를 알려주시면 반경 내 경쟁 현황, 유동인구, 리스크를 분석해드릴게요.',
  },
  {
    id: '2',
    role: 'user',
    content: '연남동에서 카페 창업을 생각 중이에요. 반경 500m로 봐주세요.',
  },
  {
    id: '3',
    role: 'agent',
    content: '네, 서울 마포구 연남동 기준으로 카페 상권을 분석할게요.',
  },
  {
    id: '4',
    role: 'tool',
    toolName: 'search_competitors',
    params: { 업종: '카페', 위치: '연남동', 반경: 500 },
    status: 'done',
    resultText: '완료 — 동일 업종 18곳 (소상공인진흥공단 · 2025.01)',
  },
  {
    id: '5',
    role: 'tool',
    toolName: 'get_population_flow',
    params: { 행정동: '연남동', 시간대: '카페' },
    status: 'loading',
  },
  {
    id: '6',
    role: 'agent',
    content: '300m로 줄이면 경쟁업체가 9곳으로 줄고, 밀집도도 34P로 낮아져요.',
    confirmButtons: [
      { label: '네, 300m로 변경', variant: 'primary', action: 'change_radius_300' },
      { label: '500m 유지', variant: 'outline', action: 'keep_radius_500' },
    ],
  },
]
