import random
from typing_extensions import Literal
from pydantic import BaseModel, Field

SCORE_FLOOR = 60
SCORE_CEILING = 100

# Both paths land on the same band so a room cannot tell who has a microphone
# and who is being flattered by the machine.
MIC_BAND_BOTTOM = 82
MIC_JITTER = 2.0


class SongScore(BaseModel):
    entry_id: str = Field(..., min_length=1)
    score: int = Field(..., ge=0, le=100)
    source: Literal["mic", "auto"]
    version: int = Field(1, ge=1)
    timestamp: float


def _clamp(score: float) -> int:
    return int(min(max(round(score), SCORE_FLOOR), SCORE_CEILING))


def score_from_performance(performance: float) -> int:
    """Map a controller's 0..1 loudness reading onto the videoke band."""
    performance = min(max(performance, 0.0), 1.0)
    scored = MIC_BAND_BOTTOM + performance * (SCORE_CEILING - MIC_BAND_BOTTOM)
    return _clamp(scored + random.uniform(-MIC_JITTER, MIC_JITTER))


def roll_score() -> int:
    """The no-microphone path, weighted the way the machines feel."""
    draw = random.random()
    if draw < 0.70:
        return random.randint(88, SCORE_CEILING)
    if draw < 0.92:
        return random.randint(75, 87)
    return random.randint(SCORE_FLOOR, 74)
