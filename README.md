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

## Stripe (test mode)

This repo uses Stripe Checkout for subscriptions with a 7-day free trial.

### Required env vars

Add these to .env.local (local dev) and to Vercel (Preview + Production). Keep Stripe in test mode for now.

- STRIPE_SECRET_KEY
  - Used by: lib/stripe.ts (Stripe client init) and all Stripe server routes.
  - Must be a full test secret key: starts with sk_test_...
- STRIPE_PRICE_PRO_MONTHLY
  - Used by: lib/stripe.ts (price selection for Checkout).
  - Must be a Stripe Price ID with recurring interval month.
- STRIPE_PRICE_PRO_YEARLY
  - Used by: lib/stripe.ts (price selection for Checkout).
  - Must be a Stripe Price ID with recurring interval year.
- STRIPE_WEBHOOK_SECRET
  - Used by: app/api/stripe/webhook/route.ts to verify webhook signatures.
  - Comes from the Stripe webhook endpoint signing secret.
- NEXT_PUBLIC_APP_URL
  - Used by: lib/stripe.ts to build Checkout success_url and cancel_url.
  - For Vercel, set this per-environment (Preview/Production) to the deployed URL.

### Webhook endpoint

- Route: /api/stripe/webhook
- Signature verification: enabled (requires STRIPE_WEBHOOK_SECRET).
- Events handled (test mode):
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted

### Deployment checklist (Vercel)

1) Set env vars in Vercel (Preview + Production).
2) Create a Stripe test mode webhook endpoint pointing to your deployed app:
   - https://<your-domain>/api/stripe/webhook
3) Verify endpoints are live:
   - GET /api/stripe/health (shows missing env vars)
   - GET /api/stripe/webhook (returns { ok: true, hasWebhookSecret: true/false })
4) Run a trial in the deployed app and confirm:
   - Stripe redirects back to the deployed domain (not localhost)
   - Analysis unlocks after checkout
   - Plan/Billing status displays correctly
