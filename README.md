# Blounderproof

Blounderproof is a practical chess opening trainer for beginner to 1600 Elo club players. The first slices focus on a clean dark UI, course selection, a true 8x8 playable board, legal move highlighting, opening prompts, answer reveal, explanations, local progress persistence, due-line review, and simple PGN course import.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current chess logic

Implemented:

- FEN piece placement and side-to-move parsing
- Legal movement for pawns, knights, bishops, rooks, queens, and kings
- Click-to-select pieces and highlighted legal destinations
- Move execution for legal moves
- Opening answer validation by UCI move
- Multi-prompt training lines with automatic opponent replies
- Per-line progress saved in `localStorage`
- Due review queue with simple line graduation after a completed correct line
- Graded review scheduling with Again, Hard, Good, and Easy
- Local imported courses saved in `localStorage`
- Basic PGN import for clean main-line SAN opening moves
- Check-aware legal move filtering
- Castling with FEN castling-right tracking
- En passant with FEN en-passant target tracking
- Check, checkmate, and stalemate status detection
- Promotion picker for board play and SAN promotion import

Known limitations for the first version:

- Progress is browser-local only, not account-based
- PGN import is intended for clean main lines and ignores variations/comments
- PGN import does not preserve NAGs, comments, or side variations as course notes yet

Those are intentional Phase 2 and Phase 3 expansion points.
