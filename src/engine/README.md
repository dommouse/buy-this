# AI Gift Recommendation Engine (`src/engine`)

Self-contained recommendation module. UI talks only to `getRecommendations` / `trackInteraction` from `src/engine/index.ts`.

## Flow (primary: `keyword-search`)

```text
Questionnaire answers
        ↓
Keyword engine (store-agnostic)
  • AI builds 4 search phrases (one per slot)
  • Block list filter — blocked phrases must PIVOT (rethink), not soft-skip
        ↓
Store adapters (pluggable)
  • Amazon first (PA-API when keyed; phrase→ASIN resolver until then)
  • Nordstrom / Etsy / Target / Macy's can plug in later without touching keywords
        ↓
AI picks best product per slot + presentation tip
        ↓
Validate live /dp/ASIN + budget/age gates + CDN images
        ↓
Results page: 4 slots with BUY THIS
```

## Modes

| `ENGINE_MODE` | Behavior |
| --- | --- |
| `keyword-search` (default) | Phrases → blocklist → store search → 4 slot picks. |
| `claude-suggest` | Legacy: Claude invents gifts directly. |
| `catalog-hybrid` | Score curated catalog, optional Lovable re-rank. |

If the keyword path fails, the engine falls back to Claude invent / Amazon catalog so results never hard-fail.

## Key modules

| Path | Role |
| --- | --- |
| `keywords/` | Phrase builder + block list + pivot (no store knowledge) |
| `stores/` | Pluggable search adapters (`amazon-search.server.ts`, registry) |
| `keyword-recommend.server.ts` | Orchestrates keyword → search → pick |
| `ai/slot-picker.server.ts` | Chooses best product per slot + tip |
| `ai/claude-client.server.ts` | Shared Claude caller |
| `catalog/product-validator.ts` | Live ASIN / budget / age gates |
| `affiliates/*` | Associates / Skimlinks BUY THIS URLs |
| `env.config.ts` | Live fallbacks when `.env` is missing |

## Env

- `ANTHROPIC_API_KEY` — Claude (phrases, pivot, store resolve, slot pick)
- `AMAZON_PARTNER_TAG` — Associates store ID on `/dp/ASIN` links
- `AMAZON_PAAPI_*` — optional live Amazon Product Advertising API
- `ENGINE_MODE=keyword-search` — primary path
- Keep `src/engine/env.config.ts` in sync for published Lovable builds

## Adding a new store

1. Implement `StoreSearchAdapter` in `stores/your-store.server.ts` (`search(phrase) → StoreProduct[]`).
2. Register it in `stores/registry.ts`.
3. Do **not** change the keyword engine.
