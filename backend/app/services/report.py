"""상권 분석 리포트 생성."""


def build_report(
    station: str,
    radius: int,
    category: str,
    competitor_count: int,
    competition_percentile: int,
) -> dict:
    if competition_percentile >= 70:
        density_desc = f'서울 상위 {100 - competition_percentile}% 수준으로 높은 경쟁 밀집도'
        risk_density = f'동일 업종 {competitor_count}개 영업 중 — {density_desc}'
    elif competition_percentile >= 40:
        density_desc = '서울 중위권 수준의 경쟁 밀집도'
        risk_density = f'동일 업종 {competitor_count}개 영업 중 — {density_desc}'
    else:
        density_desc = f'서울 하위 {competition_percentile}% 수준으로 낮은 경쟁 밀집도'
        risk_density = f'동일 업종 {competitor_count}개 영업 중 — {density_desc} (진입 여지 있음)'

    return {
        '요약': (
            f'{station} 반경 {radius}m 내 {category} 업종은 '
            f'경쟁 밀집도가 {density_desc}입니다.'
        ),
        '긍정_요인': [
            f'소상공인진흥공단 데이터 기준 반경 내 {category} {competitor_count}개 확인',
        ],
        '위험_요인': [risk_density],
        '전략_제안': [
            '반경 내 경쟁업체 분포를 지도에서 직접 확인하고 밀집 구간을 피한 입지를 검토하세요.',
        ],
        '확인_질문': [
            '예상 월 임차료 규모는 어느 정도로 보고 계신가요?',
            '직접 운영 예정인가요, 직원 고용 계획이 있나요?',
            '손익분기점 달성 목표 기간을 어느 정도로 보고 계신가요?',
        ],
        '금지어_위반': False,
    }
