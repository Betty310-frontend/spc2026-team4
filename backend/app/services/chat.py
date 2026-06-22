"""AI 에이전트 채팅 서비스 — LangGraph ReAct 에이전트 + MemorySaver."""

import json
import uuid
from collections.abc import AsyncGenerator

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import get_llm
from app.dto.chat import UIMessage
from app.services.chat_tools import make_analysis_tools

_SYSTEM = """
너는 서울 소상공인 창업 리스크 해석 도구다.

[도구 사용 규칙]
- 사용자가 업종·위치를 처음 언급하거나 변경하면 반드시 search_competitors 도구를 호출해라.
- 이미 분석된 결과에 대한 질문이나 추가 설명 요청은 도구 없이 답해라.
- 위치 추출: 역명·동네명만 station으로. 예: "선정릉역 4번 출구" → "선정릉역", "홍대 근처" → "홍대입구역"
- 업종 정규화: 아래 표에 있는 변환만 허용하고, 없으면 그대로 사용해라. 임의로 상위 카테고리로 올리지 마라.
  커피숍·커피·카페테리아 → 카페 / 헤어샵·헤어·미용·이용원 → 미용실 / 식당·밥집 → 음식점
  분식집·떡볶이 → 분식 / 치킨집·후라이드치킨 → 치킨 / 술집·호프·바 → 주점
  베이커리·빵집 → 제과점 / 병원·내과·소아과·피부과 → 의원
- 위치 제한: 서울지역이 아니면 "서울 지역만 분석 가능"이라고 안내하고 도구 호출 없이 답할것.

[도구 결과 해석 규칙]
- summary 필드를 반드시 읽고 행정동·경쟁업체 수·경쟁 밀집도·월평균 매출을 응답에 포함해라.
- dong_name 필드가 있으면 "해당 위치는 {dong_name}에 속합니다"로 먼저 알려줘라.
- monthly_avg_sales_amt가 있으면 "행정동 월평균 추정매출 X원"으로 반드시 언급해라. 단위는 만원으로 변환해서 읽기 쉽게 표현해라.
- monthly_avg_sales_cnt가 있으면 "월 X건 거래"로 함께 언급해라.
- avg_peak_population이 있으면 "핵심 시간대 평균 생활인구 X명"으로 언급해라.
- 매출·생활인구 데이터가 null이면 언급하지 마라.

[응답 규칙]
- 도구 결과 데이터만 근거로 삼아라. 데이터 외 추정은 "데이터가 없어 확인할 수 없습니다"로 답해라.
- 성공 가능성·매출 예측·폐업 확률·보장 같은 단정적 표현은 절대 금지.
- 대화 맥락을 유지하며 연속된 상담처럼 응답해라.
"""

# 프로세스 재시작 시 초기화됨 — 운영 환경에서는 AsyncPostgresSaver로 교체 필요
_checkpointer = MemorySaver()

# 도구별 진행 단계 레이블
_TOOL_STEP = {
    'search_competitors': '경쟁업체 데이터 조회 중...',
}


# SSE 형식으로 메시지 청크를 직렬화한다.
def _sse(chunk: dict) -> str:
    return f'data: {json.dumps(chunk, ensure_ascii=False)}\n\n'


def _to_lc_messages(messages: list[UIMessage]) -> list[HumanMessage | AIMessage]:
    result: list[HumanMessage | AIMessage] = []
    for msg in messages:
        text = next((p.text for p in msg.parts if p.type == 'text'), msg.content)
        if not text:
            continue
        if msg.role == 'user':
            result.append(HumanMessage(content=text))
        elif msg.role == 'assistant':
            result.append(AIMessage(content=text))
    return result


def _build_system_prompt(station: str, category: str, radius: int) -> str:
    prompt = _SYSTEM
    if station or category:
        prompt += (
            f'\n[현재 분석 컨텍스트] station={station or "없음"}, '
            f'category={category or "없음"}, radius={radius}m\n'
            '조건 변경 없는 질문에는 search_competitors를 다시 호출하지 말고 현재 컨텍스트로 답해라.'
        )
    return prompt


def _log_response(thread_id: str, tools_called: list[str], text: str) -> None:
    sep = '─' * 60
    tool_line = (
        f'  tools : {", ".join(tools_called)}' if tools_called else '  tools : (없음)'
    )
    print(f'\n{sep}')
    print(f'  thread: {thread_id}')
    print(tool_line)
    print(f'  reply :\n{text}')
    print(sep)


def _parse_tool_output(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except ValueError:
            return {}
    if hasattr(raw, 'content'):
        try:
            return json.loads(raw.content)
        except ValueError:
            return {}
        except AttributeError:
            return {}
    return {}


async def stream_ui(
    messages: list[UIMessage],
    conversation_id: str = '',
    current_station: str = '',
    current_radius: int = 500,
    current_category: str = '',
    db: AsyncSession | None = None,
    redis: Redis | None = None,
) -> AsyncGenerator[str, None]:
    thread_id = conversation_id or uuid.uuid4().hex
    config: RunnableConfig = {'configurable': {'thread_id': thread_id}}

    try:
        tools = make_analysis_tools(db, redis) if db and redis else []

        # Agent 생성
        agent = create_agent(
            model=get_llm(),
            tools=tools,
            system_prompt=_build_system_prompt(
                current_station, current_category, current_radius
            ),
            checkpointer=_checkpointer,
        )

        # 기존 대화 여부 확인
        state = await agent.aget_state(config)
        has_history = bool(state and state.values and state.values.get('messages'))

        # 대화 이력이 있으면 마지막 user 메시지만 입력으로 사용
        if has_history:
            last_user = next(
                (m for m in reversed(messages) if m.role == 'user'), messages[-1]
            )
            input_messages = _to_lc_messages([last_user])

        # 대화 이력이 없으면 전체 메시지를 입력으로 사용
        else:
            input_messages = _to_lc_messages(messages)

        part_id = uuid.uuid4().hex
        text_started = False
        text_buffer: list[str] = []
        tools_called: list[str] = []

        yield _sse({'type': 'session', 'thread_id': thread_id})
        yield _sse(
            {'type': 'step', 'label': '질문을 확인하고 있습니다...', 'done': True}
        )

        async for event in agent.astream_events(  # type: ignore[call-overload]
            {'messages': input_messages}, config=config, version='v2'
        ):
            kind = event['event']

            if kind == 'on_tool_start':
                tool_name = event['name']
                tools_called.append(tool_name)
                step_label = _TOOL_STEP.get(tool_name, '데이터 조회 중...')
                yield _sse({'type': 'step', 'label': step_label, 'done': False})
                yield _sse(
                    {
                        'type': 'tool-start',
                        'tool': tool_name,
                        'input': event['data'].get('input', {}),
                    }
                )

            elif kind == 'on_tool_end':
                tool_name = event['name']
                output = _parse_tool_output(event['data'].get('output'))
                if 'metrics' in output:
                    yield _sse(
                        {
                            'type': 'step',
                            'label': '시각화 데이터 생성 중...',
                            'done': False,
                        }
                    )
                    yield _sse({'type': 'tags', 'data': output.get('tags', [])})
                    yield _sse(
                        {
                            'type': 'map',
                            'data': {
                                'center': output.get('coords', {}),
                                'radius': output.get('radius', 500),
                                'competitors': output.get('competitors', []),
                                'dong_name': output.get('dong_name'),
                            },
                        }
                    )
                    yield _sse({'type': 'metrics', 'data': output.get('metrics', {})})
                    yield _sse({'type': 'report', 'data': output.get('report', {})})
                    yield _sse({'type': 'sources', 'data': output.get('sources', [])})
                    yield _sse({'type': 'scope', 'data': output.get('scope', {})})
                step_label = _TOOL_STEP.get(tool_name, '데이터 조회 중...')
                yield _sse({'type': 'step', 'label': step_label, 'done': True})
                yield _sse({'type': 'tool-end', 'tool': tool_name})

            elif kind == 'on_chat_model_stream':
                chunk = event['data']['chunk']
                content = chunk.content if hasattr(chunk, 'content') else ''
                if content:
                    if not text_started:
                        yield _sse(
                            {'type': 'step', 'label': '답변 생성 중...', 'done': False}
                        )
                        yield _sse({'type': 'text-start', 'id': part_id})
                        text_started = True
                    text_buffer.append(content)
                    yield _sse({'type': 'text-delta', 'id': part_id, 'delta': content})

        if text_started:
            yield _sse({'type': 'text-end', 'id': part_id})
            yield _sse({'type': 'step', 'label': '답변 생성 완료!', 'done': True})

        _log_response(thread_id, tools_called, ''.join(text_buffer))

    except Exception as e:
        yield _sse({'type': 'error', 'message': str(e)})

    yield 'data: [DONE]\n\n'
