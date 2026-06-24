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
    lat: float | None = None
    lng: float | None = None

    model_config = {
        'json_schema_extra': {
            'examples': [
                {
                    'id': 'thread-001',
                    'messages': [
                        {
                            'id': 'msg-1',
                            'role': 'user',
                            'parts': [
                                {'type': 'text', 'text': '연남동 카페 상권 분석해줘'}
                            ],
                            'content': '연남동 카페 상권 분석해줘',
                        }
                    ],
                    'station': '연남동',
                    'radius': 500,
                    'category': '카페',
                    'lat': None,
                    'lng': None,
                }
            ]
        }
    }
