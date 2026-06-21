from pydantic import BaseModel


class MessagePart(BaseModel):
    type: str
    text: str = ''

    model_config = {'extra': 'allow'}


class UIMessage(BaseModel):
    id: str
    role: str = 'user'
    parts: list[MessagePart] = []
    content: str = ''

    model_config = {'extra': 'allow'}


class ChatRequest(BaseModel):
    id: str = ''
    messages: list[UIMessage]
    station: str = ''
    radius: int = 500
    category: str = ''


class ChatResponse(BaseModel):
    id: str = ''
    messages: list[UIMessage]
    # station: str = '선정릉역'
    # radius: int = 500
    # category: str = '카페'
