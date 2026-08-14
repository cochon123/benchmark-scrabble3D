from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Placement:
    x: int
    y: int
    z: int
    letter: str
    is_blank: bool = False

    @property
    def coordinate(self) -> tuple[int, int, int]:
        return self.x, self.y, self.z

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Move:
    placements: list[Placement]
    score: int
    words: list[str] = field(default_factory=list)
    axis: str | None = None

    def key(self) -> tuple[tuple[int, int, int, str, bool], ...]:
        return tuple(
            sorted((p.x, p.y, p.z, p.letter, p.is_blank) for p in self.placements)
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "placements": [placement.to_dict() for placement in self.placements],
            "score": self.score,
            "words": self.words,
            "axis": self.axis,
        }
