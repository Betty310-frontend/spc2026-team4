"""고유명사 비식별화 유틸리티."""


def mask_name(name: str) -> str:
    """첫 글자와 마지막 글자만 남기고 중간을 *로 처리한다.

    예: "카페레꼴뜨" → "카***뜨", "주기율" → "주*율", "카페" → "카*"
    """
    if not name:
        return name
    if len(name) <= 2:
        return name[0] + '*'
    return name[0] + '*' * (len(name) - 2) + name[-1]
