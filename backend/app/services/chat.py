import json
import uuid
from collections.abc import AsyncGenerator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

from app.dto.chat import UIMessage

_STATION_COORDS: dict[str, dict[str, float]] = {
    '강남역': {'lat': 37.4979, 'lng': 127.0276},
    '선정릉역': {'lat': 37.5097, 'lng': 127.0468},
    '홍대입구역': {'lat': 37.5574, 'lng': 126.9258},
    '연남동': {'lat': 37.5661, 'lng': 126.9229},
    '성수역': {'lat': 37.5446, 'lng': 127.0559},
    '목동': {'lat': 37.5272, 'lng': 126.8748},
    '상계역': {'lat': 37.6565, 'lng': 127.0651},
}

_DEFAULT_COORDS: dict[str, float] = {'lat': 37.5665, 'lng': 126.9780}

_SYSTEM = """
너는 서울 소상공인 창업 리스크 해석 도구다.
제공된 [현재 상권 데이터]를 바탕으로 사용자의 질문에 답해라.
실제 데이터에 기반하여 답변하고, 데이터에 없는 추정·확률·성공 가능성·보장 같은 단정적 표현은 절대 금지.
대화 맥락을 유지하며, 이전 질문·답변을 참고해 연속된 상담처럼 응답해라.

[도구 사용 기준]
- 사용자가 처음으로 위치·업종·반경을 지정해 분석을 요청할 때 → request_analysis_update 호출
- 사용자가 분석 조건(위치, 업종, 반경)을 변경할 때 → request_analysis_update 호출
- 이미 분석된 데이터에 대한 질문이나 추가 상담 → 도구 호출 없이 텍스트로만 답변
"""

_CATEGORY_ICONS: dict[str, str] = {
    '카페': '☕',
    '음식점': '🍽',
    '미용실': '✂️',
    '학원': '📚',
    '편의점': '🏪',
}

_COMPETITOR_OFFSETS = [
    (0.0018, 0.0012),
    (-0.0015, 0.0020),
    (0.0010, -0.0018),
    (-0.0022, -0.0010),
    (0.0025, 0.0005),
    (-0.0008, 0.0025),
    (0.0020, -0.0022),
    (-0.0018, -0.0020),
]


@tool
def request_analysis_update(station: str, radius: int, category: str) -> str:
    """
    사용자가 위치·반경·업종으로 상권 분석을 요청하거나 조건 변경을 원할 때 호출합니다.
    이미 분석된 결과에 대한 일반 질문에는 호출하지 않습니다.
    station: 역명 또는 동네 이름 (예: 강남역, 연남동)
    radius: 분석 반경(미터, 기본값 500)
    category: 업종명 (예: 카페, 음식점, 미용실)
    """
    return 'ok'


_llm_intent = None
_llm_text = None


def get_llm_intent():
    global _llm_intent
    if _llm_intent is None:
        _llm_intent = ChatOpenAI(model='gpt-4o-mini', temperature=0).bind_tools(
            [request_analysis_update]
        )
    return _llm_intent


def get_llm_text():
    global _llm_text
    if _llm_text is None:
        _llm_text = ChatOpenAI(model='gpt-4o-mini', temperature=0)
    return _llm_text


async def get_market_data(station: str, radius: int, category: str) -> dict:
    coords = _STATION_COORDS.get(station, _DEFAULT_COORDS)

    competitors = [
        {
            'id': f'comp_{i + 1}',
            'name': f'{category} {i + 1}호점',
            'lat': coords['lat'] + lat_d,
            'lng': coords['lng'] + lng_d,
            'type': 'same' if i < 6 else 'similar',
        }
        for i, (lat_d, lng_d) in enumerate(_COMPETITOR_OFFSETS)
    ]

    return {
        'station': station,
        'radius': radius,
        'category': category,
        'coords': coords,
        'metrics': {
            'competitor_count': 42,
            'competition_percentile': 73,
            'population_flow_percentile': 68,
            'closure_rate_change': 4.2,
            'primary_demographic': '20-30대 직장인(주중 집중형)',
            'data_reference_month': '2025-12',
        },
        'competitors': competitors,
        'report': {
            '요약': (
                f'{station} 반경 {radius}m 내 {category} 업종은 '
                f'경쟁 밀집도가 서울 상위 27% 수준으로 높으며, '
                f'유동인구는 평균 이상입니다.'
            ),
            '긍정_요인': [
                '유동인구 서울 상위 32% 수준 (평일 오전·저녁 집중형)',
                '20~30대 직장인 비중 높아 테이크아웃 수요 안정적',
                '반경 내 대형 오피스 밀집으로 점심·오후 수요 기대 가능',
            ],
            '위험_요인': [
                '동일 업종 42개 영업 중 — 서울 상위 27% 수준의 높은 경쟁 밀집도',
                '전년 대비 폐업률 4.2% 증가 추세',
                '주말 유동인구 급감 (주중 대비 약 40% 감소)',
            ],
            '전략_제안': [
                '주중 점심·오후 시간대 특화 메뉴 구성으로 직장인 고정 수요 공략',
                '프랜차이즈와 차별화된 독립 카페 콘셉트 고려',
                '초기 임차 계약 시 단기(1년) 옵션 우선 검토',
            ],
            '확인_질문': [
                '예상 월 임차료 규모는 어느 정도로 보고 계신가요?',
                '직접 운영 예정인가요, 직원 고용 계획이 있나요?',
                '테이크아웃 중심인가요, 좌석 중심인가요?',
                '경쟁 업체 대비 차별화 포인트는 무엇인가요?',
                '손익분기점 달성 목표 기간을 어느 정도로 보고 계신가요?',
            ],
            '금지어_위반': False,
        },
        'tags': [
            {'label': category, 'icon': _CATEGORY_ICONS.get(category, '🏪')},
            {'label': station, 'icon': '📍'},
            {'label': f'반경 {radius}m', 'icon': '📏'},
        ],
    }


def _sse(chunk: dict) -> str:
    return f'data: {json.dumps(chunk, ensure_ascii=False)}\n\n'


def _build_lc_messages(messages: list[UIMessage], market_data: dict) -> list:
    m = market_data['metrics']
    context = (
        f'역: {market_data["station"]}, '
        f'반경: {market_data["radius"]}m, '
        f'업종: {market_data["category"]}, '
        f'동종 업소 수: {m["competitor_count"]}개, '
        f'경쟁 밀집도: 서울 상위 {100 - m["competition_percentile"]}%, '
        f'유동인구: 서울 상위 {100 - m["population_flow_percentile"]}%, '
        f'주요 유동인구: {m["primary_demographic"]}, '
        f'전년 대비 폐업률 변화: {m["closure_rate_change"]}% 증가, '
        f'데이터 기준월: {m["data_reference_month"]}'
    )

    lc_messages: list = [
        SystemMessage(content=f'{_SYSTEM}\n\n[현재 상권 데이터]\n{context}')
    ]

    for msg in messages:
        text = next((p.text for p in msg.parts if p.type == 'text'), msg.content)
        if not text:
            continue
        if msg.role == 'user':
            lc_messages.append(HumanMessage(content=text))
        elif msg.role == 'assistant':
            lc_messages.append(AIMessage(content=text))

    return lc_messages


async def stream_ui(
    messages: list[UIMessage], market_data: dict
) -> AsyncGenerator[str, None]:
    part_id = uuid.uuid4().hex
    lc_messages = _build_lc_messages(messages, market_data)

    intent = await get_llm_intent().ainvoke(lc_messages)

    active_data = market_data
    if intent.tool_calls:
        args = intent.tool_calls[0]['args']
        active_data = await get_market_data(
            station=args.get('station', market_data['station']),
            radius=int(args.get('radius', market_data['radius'])),
            category=args.get('category', market_data['category']),
        )
        yield _sse({'type': 'tags', 'data': active_data['tags']})
        yield _sse(
            {
                'type': 'map',
                'data': {
                    'center': active_data['coords'],
                    'radius': active_data['radius'],
                    'competitors': active_data['competitors'],
                },
            }
        )
        yield _sse({'type': 'metrics', 'data': active_data['metrics']})
        yield _sse({'type': 'report', 'data': active_data['report']})

    text_messages = _build_lc_messages(messages, active_data)
    yield _sse({'type': 'text-start', 'id': part_id})
    async for chunk in get_llm_text().astream(text_messages):
        if chunk.content:
            yield _sse({'type': 'text-delta', 'id': part_id, 'delta': chunk.content})
    yield _sse({'type': 'text-end', 'id': part_id})

    yield 'data: [DONE]\n\n'
