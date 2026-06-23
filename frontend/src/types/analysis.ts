export interface AnalysisContext {
  industry: string | null // 예: "카페", "학원", "미용실"
  location: string | null // 예: "연남동", "목동"
  radius: number | null // 미터 단위. 예: 500
  userLocation: { lat: number; lng: number } | null // GPS 좌표 (지도 중심 이동용)
}
