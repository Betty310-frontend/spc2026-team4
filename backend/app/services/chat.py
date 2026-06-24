"""AI 에이전트 채팅 서비스 — LangGraph ReAct 에이전트 + MemorySaver."""
# mypy: ignore-errors
import asyncio
import json
import uuid
from collections.abc import AsyncGenerator

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.llm import get_llm
from app.dto.chat import UIMessage
from app.services.chat_tools import make_analysis_tools
from app.services.rag_service import search_rag_chunks

# thread별 마지막 분석 조건을 Redis에 저장할 때 사용하는 키 포맷 및 TTL
_CTX_KEY_FMT = 'ctx:{thread_id}'
_CTX_TTL = 60 * 60 * 24  # 24h


async def _load_last_context(redis: Redis, thread_id: str) -> dict:
    raw = await redis.get(_CTX_KEY_FMT.format(thread_id=thread_id))
    if raw:
        try:
            return json.loads(raw)
        except ValueError:
            pass
    return {}


async def _save_context(
    redis: Redis, thread_id: str, station: str, category: str, radius: int
) -> None:
    await redis.setex(
        _CTX_KEY_FMT.format(thread_id=thread_id),
        _CTX_TTL,
        json.dumps(
            {'station': station, 'category': category, 'radius': radius},
            ensure_ascii=False,
        ),
    )


def _detect_context_change(
    prev: dict, station: str, category: str, radius: int
) -> str | None:
    """이전 분석 조건 대비 변경된 항목을 문자열로 반환한다. 변경 없으면 None."""
    if not prev:
        return None
    parts = []
    if prev.get('station') != station:
        parts.append(f'위치 {prev["station"]} → {station}')
    if prev.get('category') != category:
        parts.append(f'업종 {prev["category"]} → {category}')
    if prev.get('radius') != radius:
        parts.append(f'반경 {prev["radius"]}m → {radius}m')
    return ', '.join(parts) if parts else None


_SYSTEM = """
너는 서울 소상공인 창업 리스크 해석 도구다.

[도구 사용 규칙]
- 사용자가 업종·위치를 처음 언급하거나 변경하면 반드시 search_competitors를 호출해라. 핵심시간대·유동인구·매출 질문이 섞여 있어도 search_competitors 하나로 모두 해결된다.
- get_population_flow는 경쟁업체 분석 이후 인구 흐름만 추가로 묻는 경우에만 호출해라.
- 이미 분석된 결과에 대한 질문이나 추가 설명 요청은 도구 없이 답해라.
- 위치 추출: 역명·동네명만 station으로. 예: "선정릉역 4번 출구" → "선정릉역", "홍대 근처" → "홍대입구역"
  텍스트에서 위치를 파악할 수 없으면("여기", "이 위치", "현재 위치" 등) station을 빈 문자열("")로 전달해라. 시스템이 좌표로 자동 처리한다.
- 업종 정규화: 아래 표에 있는 변환만 허용하고, 없으면 그대로 사용해라. 임의로 상위 카테고리로 올리지 마라.
  커피숍·커피·카페테리아 → 카페 / 헤어샵·헤어·미용·이용원 → 미용실 / 식당·밥집 → 음식점
  분식집·떡볶이 → 분식 / 치킨집·후라이드치킨 → 치킨 / 술집·호프·바 → 주점
  베이커리·빵집 → 제과점 / 병원·내과·소아과·피부과 → 의원
- 위치 제한: 서울지역이 아니면 "서울 지역만 분석 가능"이라고 안내하고 도구 호출 없이 답할것.

[첫 분석 응답 형식 — search_competitors 결과 수신 시 반드시 아래 항목을 모두 포함해라]
1. 행정동: dong_name 필드가 있으면 "해당 위치는 {dong_name}에 속합니다"로 시작.
2. 경쟁업체: competitor_count + competition_percentile → "반경 내 동일 업종 N개, 서울 X퍼센타일 수준"
3. 추정매출 (metrics 안의 필드 사용):
   - per_store_est_amt → 업소 1개당 월 추정매출. 이 값을 주요 매출 지표로 사용해라. 만원 단위로 표현.
   - per_store_est_cnt → 업소당 월 추정 거래건수.
   - monthly_avg_sales_amt는 행정동 전체 합산이므로 직접 언급하지 마라.
   - weekday_avg_amt / weekend_avg_amt → 주중/주말 비율 비교. 주중이 높으면 "직장인 수요 중심" 등 해석.
     (이 값도 전체 합산이므로 비율만 언급. 예: "주중이 주말보다 약 X배 높습니다")
   - top_sales_age → 매출 1위 연령대, sales_by_age → 연령대별 매출 비중 상위 2~3개 언급.
   - peak_sales_slot → 매출 최고 시간대.
4. 생활인구 (metrics 안의 필드 사용):
   - avg_peak_population → 핵심 시간대 평균 인구
   - peak_population_hour → 인구 최다 시간대
   - male_pop_ratio / female_pop_ratio → 이미 %로 계산된 값. "남성 X%, 여성 Y%" 그대로 표현. 합이 100%임.
   - population_by_age_ratio → 각 연령대 비율(%), 상위 2~3개 언급.
   - top_population_age → 유동인구 주요 연령대
5. 데이터가 null인 항목은 언급하지 마라.

[고유명사 비식별화 규칙]
- 도구가 반환한 top_competitors의 경쟁업체는 반드시 display_name만 사용해라. analysis_name은 절대 응답에 포함하지 마라.
- 응답 중 네가 직접 언급하는 모든 상호명·건물명·브랜드명은 첫 글자와 마지막 글자만 표시하고 중간을 *로 처리해라.
  예: "스타벅스" → "스***스", "현대빌딩" → "현***딩", "GS25" → "G*5"
- 역명·행정동명·구명 등 공공 지리 정보는 그대로 표기해라.

[응답 규칙]
- 도구 결과 데이터와 RAG 참고 문서만 근거로 삼아라. 데이터 외 추정은 "데이터가 없어 확인할 수 없습니다"로 답해라.
- 성공 가능성·매출 예측·폐업 확률·보장 같은 단정적 표현은 절대 금지.
- 대화 맥락을 유지하며 연속된 상담처럼 응답해라.
"""

_checkpointer = MemorySaver()

_TOOL_STEP = {
    'search_competitors': '경쟁업체 데이터 조회 중...',
    'get_population_flow': '생활인구 데이터 조회 중...',
    'calc_competition_percentile': '경쟁 밀집도 계산 중...',
    'get_positioning_data': '포지셔닝 데이터 조회 중...',
}


def _sse(chunk: dict) -> str:
    return f'data: {json.dumps(chunk, ensure_ascii=False)}\n\n'


def _to_lc_messages(messages: list[UIMessage]) -> list[BaseMessage]:
    result: list[BaseMessage] = []
    for msg in messages:
        text = next((p.text for p in msg.parts if p.type == 'text'), msg.content)
        if not text:
            continue
        if msg.role == 'user':
            result.append(HumanMessage(content=text))
        elif msg.role == 'assistant':
            result.append(AIMessage(content=text))
    return result


def _build_system_prompt(
    station: str,
    category: str,
    radius: int,
    lat: float | None = None,
    lng: float | None = None,
) -> str:
    prompt = _SYSTEM
    # station이 있을 때만 "이미 분석된 컨텍스트"로 간주해 재호출을 억제한다.
    # category만 있는 경우(첫 메시지)는 LLM이 메시지에서 위치를 추출해야 한다.
    if station:
        prompt += (
            f'\n[현재 분석 컨텍스트] station={station}, '
            f'category={category or "없음"}, radius={radius}m\n'
            '조건 변경 없는 질문에는 search_competitors를 다시 호출하지 말고 현재 컨텍스트로 답해라.'
        )
    elif lat is not None and lng is not None:
        prompt += (
            f'\n[필수] 사용자가 지도에서 위치를 이미 선택했다 (lat={lat}, lng={lng}).'
            f' 반경은 {radius}m, 업종은 {category or "없음"}.'
            ' 역명이 없어도 위치를 되묻지 말고 즉시 station=""로 search_competitors를 호출해라.'
        )
    if not station and category:
        prompt += (
            f'\n[요청 파라미터] category={category}, radius={radius}m.'
            ' search_competitors 호출 시 반드시 이 반경을 사용해라.'
        )
    return prompt


def _log_response(thread_id: str, tools_called: list[str], text: str) -> None:
    sep = '─' * 10
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


def _get_last_user_message(messages: list[UIMessage]) -> UIMessage:
    return next((m for m in reversed(messages) if m.role == 'user'), messages[-1])


def _get_message_text(message: UIMessage) -> str:
    return next((p.text for p in message.parts if p.type == 'text'), message.content)


def _build_rag_message(
    current_category: str,
    question: str,
) -> tuple[SystemMessage | None, list[dict]]:
    if not current_category or not question:
        return None, []

    try:
        rag_sources = search_rag_chunks(
            display_name=current_category,
            question=question,
            n_results=5,
        )
    except Exception as e:
        print(f'[RAG] 검색 실패: {e}')
        return None, []

    top_sources = rag_sources[:3]

    if not top_sources:
        return None, []

    rag_context = '\n\n'.join(
        [
            f"[근거 {idx + 1}]\n"
            f"문서: {source.get('document_title')}\n"
            f"섹션: {source.get('section_title')}\n"
            f"내용:\n{source.get('chunk_text')}"
            for idx, source in enumerate(top_sources)
        ]
    )

    rag_message = SystemMessage(
        content=f"""
다음은 업종 '{current_category}'와 관련된 RAG 참고 문서입니다.

답변 규칙:
1. 아래 근거를 우선 사용하세요.
2. 근거에 없는 내용은 추측하지 말고 "문서에서 확인되지 않습니다"라고 말하세요.
3. 답변 마지막에 참고한 문서명을 간단히 표시하세요.

{rag_context}
""".strip()
    )

    return rag_message, top_sources


async def stream_ui(
    messages: list[UIMessage],
    conversation_id: str = '',
    current_station: str = '',
    current_radius: int = 500,
    current_category: str = '',
    current_lat: float | None = None,
    current_lng: float | None = None,
    db: AsyncSession | None = None,
    redis: Redis | None = None,
) -> AsyncGenerator[str, None]:
    thread_id = conversation_id or uuid.uuid4().hex
    config: RunnableConfig = {'configurable': {'thread_id': thread_id}}

    print(
        f'\n[REQ] thread={thread_id}'
        f' station={current_station!r} category={current_category!r}'
        f' radius={current_radius} lat={current_lat} lng={current_lng}'
    )

    try:
        tools = (
            make_analysis_tools(db, redis, current_lat, current_lng)
            if db and redis
            else []
        )

        # Redis에서 이전 분석 조건을 불러와 조건 변경 감지에 사용한다
        prev_ctx: dict = {}
        if redis and current_station:
            prev_ctx = await _load_last_context(redis, thread_id)

        agent = create_agent(
            model=get_llm(),
            tools=tools,
            system_prompt=_build_system_prompt(
                current_station,
                current_category,
                current_radius,
                current_lat,
                current_lng,
            ),
            checkpointer=_checkpointer,
        )

        state = await agent.aget_state(config)
        has_history = bool(state and state.values and state.values.get('messages'))

        last_user = _get_last_user_message(messages)
        last_user_text = _get_message_text(last_user)

        rag_message, rag_sources = _build_rag_message(
            current_category=current_category,
            question=last_user_text,
        )

        if has_history:
            input_messages = _to_lc_messages([last_user])
        else:
            input_messages = _to_lc_messages(messages)

        if prev_ctx and current_station:
            change_desc = _detect_context_change(
                prev_ctx, current_station, current_category, current_radius
            )
            if change_desc:
                retrigger = HumanMessage(
                    content=(
                        f'[분석 조건 변경 감지: {change_desc}]'
                        ' 변경된 조건으로 search_competitors를 즉시 다시 호출해라.'
                    )
                )
                input_messages = [retrigger, *input_messages]

        if rag_message:
            input_messages = [rag_message] + input_messages

        part_id = uuid.uuid4().hex
        text_started = False
        text_buffer: list[str] = []
        tools_called: list[str] = []

        yield _sse({'type': 'session', 'thread_id': thread_id})
        yield _sse(
            {'type': 'step', 'label': '질문을 확인하고 있습니다...', 'done': True}
        )

        if rag_sources:
            yield _sse(
                {
                    'type': 'sources',
                    'data': [
                        {
                            'title': source.get('document_title'),
                            'section': source.get('section_title'),
                            'file_path': source.get('file_path'),
                            'file_type': source.get('file_type'),
                        }
                        for source in rag_sources
                    ],
                }
            )

        async with asyncio.timeout(90):
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
                    # search_competitors 도구 실행 완료 후 현재 분석 조건을 Redis에 저장한다
                    if (
                        tool_name == 'search_competitors'
                        and 'metrics' in output
                        and redis
                        and current_station
                    ):
                        await _save_context(
                            redis,
                            thread_id,
                            current_station,
                            current_category,
                            current_radius,
                        )
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
                        yield _sse(
                            {'type': 'metrics', 'data': output.get('metrics', {})}
                        )
                        yield _sse(
                            {'type': 'summarize', 'data': output.get('summarize', {})}
                        )
                        yield _sse(
                            {'type': 'sources', 'data': output.get('sources', [])}
                        )
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
                                {
                                    'type': 'step',
                                    'label': '답변 생성 중...',
                                    'done': False,
                                }
                            )
                            yield _sse({'type': 'text-start', 'id': part_id})
                            text_started = True
                        text_buffer.append(content)
                        yield _sse(
                            {'type': 'text-delta', 'id': part_id, 'delta': content}
                        )

        if text_started:
            yield _sse({'type': 'text-end', 'id': part_id})
            yield _sse({'type': 'step', 'label': '답변 생성 완료!', 'done': True})

        _log_response(thread_id, tools_called, ''.join(text_buffer))

    except asyncio.TimeoutError:
        # 전체 에이전트 실행이 90초 제한을 초과한 경우
        yield _sse(
            {
                'type': 'error',
                'code': 'TIMEOUT',
                'message': '분석 시간이 초과되었습니다 (90초). 잠시 후 다시 시도해주세요.',
            }
        )
    except asyncio.CancelledError:
        # 클라이언트 연결 끊김 또는 외부 취소 신호로 태스크가 중단된 경우
        yield _sse(
            {
                'type': 'error',
                'code': 'CANCELLED',
                'message': '분석이 취소되었습니다.',
            }
        )
    except Exception as e:
        err_msg = str(e)
        if 'tool_call_id' in err_msg or 'did not have response messages' in err_msg:
            # 이전 요청에서 tool_call이 완료되지 않아 대화 이력이 깨진 경우 — thread 초기화
            try:
                _checkpointer.storage.pop(thread_id, None)
            except Exception:
                pass
            yield _sse(
                {
                    'type': 'error',
                    'code': 'THREAD_RESET',
                    'message': '대화 상태를 초기화했습니다. 같은 메시지로 다시 보내주세요.',
                }
            )
        else:
            yield _sse(
                {
                    'type': 'error',
                    'code': 'AGENT_ERROR',
                    'message': err_msg or '에이전트 오류가 발생했습니다.',
                }
            )

    yield 'data: [DONE]\n\n'