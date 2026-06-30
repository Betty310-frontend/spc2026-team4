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
                    'id': '',
                    'messages': [
                        {
                            'id': '',
                            'role': 'user',
                            'parts': [
                                {'type': 'text', 'text': '연남동 카페 상권 분석해줘'}
                            ],
                            'content': '연남동 카페 상권 분석해줘',
                        }
                    ],
                    'station': '',
                    'radius': 500,
                    'category': '',
                    'lat': None,
                    'lng': None,
                }
            ]
        }
    }
