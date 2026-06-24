from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from app.core.config import get_settings

_llm: ChatOpenAI | None = None


# LLM singleton 인스턴스를 반환한다.
def get_llm() -> ChatOpenAI:
    # global에 _llm 선언
    global _llm

    # LLM 인스턴스가 없으면 생성
    if _llm is None:
        _llm = ChatOpenAI(
            api_key=SecretStr(get_settings().openai_api_key),
            model=get_settings().openai_model_name,
            temperature=0,
            timeout=60,
        )

    # 있으면 기존 인스턴스를 반환
    return _llm
