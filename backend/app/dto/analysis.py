from pydantic import BaseModel


class H3HexagonItem(BaseModel):
    h3Index: str
    count: int


class CompetitorItem(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    type: str
    category: str | None = None
    address: str | None = None


class CenterCoords(BaseModel):
    lat: float
    lng: float


class CompetitorsResponse(BaseModel):
    total: int
    same_type: int
    similar_type: int
    data_source: str
    base_date: str
    center: CenterCoords
    radius_m: int
    fallback: bool
    fallback_reason: str | None = None
    data: list[CompetitorItem]


class PopulationHourItem(BaseModel):
    hour: str
    count: int


class PopulationResponse(BaseModel):
    dong_code: str
    dong_name: str | None
    base_date: str
    data_source: str
    weighted_avg: float | None
    percentile: int | None
    time_weights_applied: list[str]
    fallback: bool
    fallback_reason: str | None = None
    data: list[PopulationHourItem]


class CompetitionPercentileResponse(BaseModel):
    percentile: int
    tier: str
    label: str
    h3_resolution: int
    competitor_density: float
    population_normalized: bool
    data_source: str
    base_date: str
    fallback: bool
