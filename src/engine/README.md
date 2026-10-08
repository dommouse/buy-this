# AI Gift Recommendation Engine (`src/engine`)

Self-contained recommendation module. UI talks only to `getRecommendations` / `trackInteraction` from `src/engine/index.ts`.

## Flow

```text
Questionnaire answers (GiftAnswers)
        ↓
results.tsx → getRecommendations (server fn)
        ↓
recommend.server.ts
        ↓
Claude invents Amazon gifts from questionnaire bounds (budget/interests/avoid)
        ↓
Validate live ASINs + hard budget filter + product-detail links only
        ↓
Amazon Associates tag on BUY THIS /dp/ASIN URLs (+ official ASIN images)
        ↓
Upsert products + log recommendations
        ↓
Background engine_train RPC (click learning)
```

## Modes

| `ENGINE_MODE` | Behavior |
| --- | --- |
| `claude-suggest` (default) | Claude proposes gifts; BUY THIS prefers Amazon Associates links. |
| `catalog-hybrid` | Score curated Amazon/DB catalog, optional Lovable re-rank. |

If Claude is unavailable, the engine falls back to the Amazon gift catalog so the results page never hard-fails.

## Key files

| Path | Role |
| --- | --- |
| `config.ts` | Feature flags + env |
| `recommend.functions.ts` | TanStack server fn boundary |
| `recommend.server.ts` | Orchestration |
| `ai/claude-suggest.server.ts` | Anthropic Claude gift generation |
| `ai/reranker.server.ts` | Legacy catalog re-ranker |
| `affiliates/amazon.ts` | Amazon Associates tagging + search/ASIN URLs |
| `affiliates/links.ts` | Unified BUY THIS URL builder |
| `affiliates/skimlinks.ts` | Non-Amazon affiliate wrapping |
| `features/profile.ts` | Questionnaire → features / segment |
| `scoring/*` | Content/budget/behavior scoring (fallback) |
| `data/engine-repository.ts` | Supabase reads/writes + training |
| `tracking.ts` | Browser impression/click events |
| `catalog/amazon-catalog.ts` | Curated Amazon gifts (fallback / hybrid) |
| `catalog/starter-catalog.ts` | Legacy emergency list |

## Env (see root `.env`)

- `ANTHROPIC_API_KEY` — required for Claude suggestions
- `AMAZON_PARTNER_TAG` / `AMAZON_STORE_ID` — Associates store ID (e.g. `rcbuythis20-20`)
- `AMAZON_PAAPI_*` — optional live Amazon Product Advertising API
- `SKIMLINKS_PUBLISHER_ID` — when ready, wrap non-Amazon destinations
- `ENGINE_*` — toggles, timeouts, training interval
- `DB_PASSWORD` / `DATABASE_URL` — apply migrations `0002` + `0003`

## Learning loop

1. Each Claude gift is upserted into `products` with a stable `claude-{slug}` id.
2. Impressions / clicks / buy_clicks land in `interaction_events`.
3. `engine_train` rebuilds `product_segment_stats` and activates a new `model_versions` row.
4. Later Claude prompts receive top CTR winners for the same segment.
