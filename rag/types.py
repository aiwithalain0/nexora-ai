
from dataclasses import dataclass


@dataclass
class Hit:
    chunk_id: str
    text: str
    source: str
    page: int
    score: float
