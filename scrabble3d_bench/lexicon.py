from __future__ import annotations

from pathlib import Path

from .constants import BOARD_SIZE


class Lexicon:
    def __init__(self, words: set[str]) -> None:
        self.words = words
        self.words_by_length: dict[int, tuple[str, ...]] = {
            length: tuple(sorted(word for word in words if len(word) == length))
            for length in range(2, BOARD_SIZE + 1)
        }

    @classmethod
    def from_path(cls, path: Path) -> "Lexicon":
        words = {
            raw.strip().upper()
            for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines()
            if 2 <= len(raw.strip()) <= BOARD_SIZE
            and raw.strip().isalpha()
            and raw.strip().isascii()
        }
        if not words:
            raise ValueError(f"Lexicon at {path} did not yield any 2–{BOARD_SIZE} letter words.")
        return cls(words)

    def contains(self, word: str) -> bool:
        return word.upper() in self.words

    def candidate_words(self) -> tuple[str, ...]:
        return tuple(word for length in self.words_by_length.values() for word in length)
