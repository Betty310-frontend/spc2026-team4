from pydantic import BaseModel


class H3HexagonItem(BaseModel):
    h3Index: str
    count: int
