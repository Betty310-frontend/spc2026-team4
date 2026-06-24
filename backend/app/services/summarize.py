"""상권 분석 요약 데이터 생성."""


def build_summarize(
    station: str,
    radius: int,
    category: str,
    competitor_count: int,
    competition_percentile: int,
    per_store_est_amt: int | None = None,
    per_store_est_cnt: int | None = None,
) -> dict:
    if competition_percentile >= 70:
        density_desc = (
            f'서울 상위 {100 - competition_percentile}% 수준으로 높은 경쟁 밀집도'
        )
        risk_density = f'동일 업종 {competitor_count}개 영업 중 — {density_desc}'
    elif competition_percentile >= 40:
        density_desc = '서울 중위권 수준의 경쟁 밀집도'
        risk_density = f'동일 업종 {competitor_count}개 영업 중 — {density_desc}'
    else:
        density_desc = f'서울 하위 {competition_percentile}% 수준으로 낮은 경쟁 밀집도'
        risk_density = (
            f'동일 업종 {competitor_count}개 영업 중 — {density_desc} (진입 여지 있음)'
        )

    if competition_percentile >= 70:
        swot_threat = (
            f'서울 상위 {100 - competition_percentile}% 수준의 높은 경쟁 밀집도'
        )
        swot_opportunity = (
            '경쟁이 높은 상권은 수요 검증이 된 지역임을 의미할 수 있습니다.'
        )
    elif competition_percentile >= 40:
        swot_threat = '서울 중위권 수준으로 경쟁이 점차 심화될 가능성이 있습니다.'
        swot_opportunity = '중위권 상권으로 과포화되지 않은 입지 탐색 여지가 있습니다.'
    else:
        swot_threat = '공급 부족 지역은 수요 자체가 낮을 가능성도 고려해야 합니다.'
        swot_opportunity = f'반경 내 동일 업종 수({competitor_count}개)가 적어 선점 효과를 기대할 수 있습니다.'

    positive = []
    if competition_percentile < 40:
        positive.append(
            f'반경 내 {category} {competitor_count}개로 경쟁이 적어 선점 효과를 기대할 수 있습니다.'
        )
    elif competition_percentile >= 70:
        positive.append(
            f'{category} {competitor_count}개가 영업 중인 검증된 상권으로 업종 수요가 확인된 입지입니다.'
        )

    if per_store_est_amt is not None:
        cnt_str = f' ({per_store_est_cnt:,}건)' if per_store_est_cnt else ''
        positive.append(
            f'업소당 월 추정매출 {per_store_est_amt:,}원{cnt_str} (행정동 매출 ÷ 경쟁업체 수 기준 참고값)'
        )

    return {
        '요약': (
            f'{station} 반경 {radius}m 내 {category} 업종은 '
            f'경쟁 밀집도가 {density_desc}입니다.'
            + (
                f' 업소당 월 추정매출은 {per_store_est_amt:,}원입니다.'
                if per_store_est_amt
                else ''
            )
        ),
        '긍정_요인': positive,
        '위험_요인': [risk_density],
        '전략_제안': [
            '반경 내 경쟁업체 분포를 지도에서 직접 확인하고 밀집 구간을 피한 입지를 검토하세요.',
        ],
        '확인_질문': [
            '직접 운영 예정인가요, 직원 고용 계획이 있나요?',
            '손익분기점 달성 목표 기간을 어느 정도로 보고 계신가요?',
            '경쟁업체 대비 차별화 포인트로 고려하고 계신 것이 있나요?',
        ],
        'swot': {
            '강점': [
                f'반경 내 {category} 업소 분포 데이터 확보 (소상공인진흥공단 기준)'
            ],
            '약점': [f'동일 업종 {competitor_count}개와의 직접 경쟁 불가피'],
            '기회': [swot_opportunity],
            '위협': [swot_threat],
        },
        '금지어_위반': False,
    }
