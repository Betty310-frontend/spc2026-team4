// ── Yellow 램프 (카카오 공식 브랜드 컬러 기반) ────────────
export const YELLOW = {
  50: '#FFFBE6',
  100: '#FFF3A3',
  200: '#FFE812', // 카카오 공식 브랜드 컬러
  400: '#E6D100',
  600: '#B5A300',
  800: '#7A6E00',
  900: '#4A4200',
} as const

// ── Indigo 램프 (UI 서브 컬러) ──────────────────────────
export const INDIGO = {
  50: '#EDEDFD',
  100: '#C5C6F5',
  200: '#9B9EEC',
  400: '#5C5FC4',
  600: '#3C3FC4', // sub primary
  800: '#1F2080', // hover / dark text
  900: '#0D0F52',
} as const

// ── 중립 색상 ───────────────────────────────────────────────
export const WHITE = '#ffffff'               // 기본 흰색
export const SURFACE_MUTED = '#f7f7f5'          // 면책 문구·반경 칩 배경
export const TEXT_MUTED = '#999999'              // 비활성/보조 레이블
export const TEXT_SECONDARY = '#555555'          // 중간 대비 텍스트 (칩 레이블 등)
export const BORDER_SUBTLE = 'rgba(0,0,0,0.11)' // 미묘한 테두리

// ── 지도 마커 ──────────────────────────────────────────────
export const MARKER_COLORS = {
  candidate: YELLOW[200],      // 내 후보지 — #FFE812
  candidateBorder: YELLOW[600], // 후보지 마커 테두리 — #B5A300 (지도 위 가시성)
  same: '#E24B4A',             // 동일 업종 — Red 400
  similar: '#EF9F27',          // 유사 업종 — Amber 400
} as const

// ── 지표 카드 배지 (tier 기반) ─────────────────────────────
export const BADGE_COLORS = {
  high: { bg: '#F09595', text: '#501313' }, // 경쟁 매우 높음 — Red 200
  mid:  { bg: '#EF9F27', text: '#412402' }, // 경쟁 보통      — Amber 400
  low:  { bg: '#97C459', text: '#173404' }, // 경쟁 낮음      — Green 200
  info: { bg: INDIGO[50], text: INDIGO[800] }, // 정보 — Indigo
} as const

// ── CTA 버튼 ───────────────────────────────────────────────
export const BUTTON_COLORS = {
  primary:       { bg: YELLOW[200], text: YELLOW[900] },       // 메인 CTA — 카카오 옐로우
  primaryHover:  { bg: YELLOW[400], text: YELLOW[900] },       // hover
  secondary:     { bg: INDIGO[600], text: '#ffffff' },          // 서브 CTA — Indigo
  secondaryHover:{ bg: INDIGO[800], text: INDIGO[100] },        // hover
  ghost:         { bg: '#f0f0f0', text: TEXT_SECONDARY, border: '#dddddd' }, // 중립
} as const

// ── SWOT 4분면 ─────────────────────────────────────────────
// 배지와 계열을 달리해 위계 구분
export const SWOT_COLORS = {
  강점: { bg: '#E1F5EE', text: '#085041' },         // Teal 50
  약점: { bg: '#FAECE7', text: '#712B13' },         // Coral 50
  기회: { bg: YELLOW[50],  text: YELLOW[800] },     // Yellow 50 — 카카오 옐로우 계열
  위협: { bg: INDIGO[50],  text: INDIGO[800] },     // Indigo 50
} as const

// ── 거시환경 메모 ───────────────────────────────────────────
export const MACRO_MEMO_COLORS = {
  bg:   YELLOW[50],  // #FFFBE6
  text: YELLOW[800], // #7A6E00
  icon: YELLOW[800],
} as const

// ── 체크리스트 배지 ────────────────────────────────────────
export const CHECKLIST_BADGE_COLORS = {
  required:    { bg: '#F09595',  text: '#501313' },          // 필수 — Red 200
  recommended: { bg: YELLOW[100], text: YELLOW[900] },       // 권장 — Yellow 100
  guide:       { bg: INDIGO[50],  text: INDIGO[800] },       // 창업 입문 가이드 — Indigo 50
} as const

// 창업 입문 가이드 항목 카드 테두리
export const GUIDE_ITEM_BORDER = INDIGO[400] // #5C5FC4

// ── 에이전트 상태 ───────────────────────────────────────────
export const AGENT_STATUS_COLORS = {
  idle:      '#639922', // 대기 중
  analyzing: '#BA7517', // 분석 중
  done:      '#639922', // 분석 완료
  chatting:  '#639922', // 대화 중
} as const

// ── topbar 칩 ──────────────────────────────────────────────
export const CHIP_COLORS = {
  업종: { bg: YELLOW[50], border: YELLOW[200], dot: YELLOW[600] }, // 카카오 옐로우 계열
  위치: { bg: INDIGO[50], border: INDIGO[100], dot: INDIGO[400] }, // Indigo 계열
  반경: { bg: SURFACE_MUTED, border: BORDER_SUBTLE, dot: undefined },
} as const

// ── 체크박스 (완료 상태) ────────────────────────────────────
export const CHECKBOX_DONE = {
  bg:     INDIGO[600], // #3C3FC4
  border: INDIGO[600],
} as const
