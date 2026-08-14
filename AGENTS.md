# Project contract

The north-star evaluation is unaided 3D Scrabble move generation:

> Given only the 15×15×15 board state, rack, coordinate convention, and rules, the
> model must produce one legal, exact-optimal move without hidden candidates,
> solver hints, coordinates, scores, or search results.

Candidate ranking, solver-assisted recovery, pass@k, legality, and score ratio
are diagnostics. Never report them as exact-optimal unaided accuracy. Keep the
dataset fixed when comparing models. A result only counts when the model returns
new tile placements as `(x, y, z, letter)` in one raw JSON tool envelope.
