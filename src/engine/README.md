# Gift Brain (`src/engine`)

Self-contained recommendation engine for BUY THIS.

**Search objects + hard filters are always local.** Claude is optional and only
picks the final 4 + Gift Tips when `ENGINE_USE_AI=true`.

## Flow

```text
Path questionnaire (max 8 steps)
        ↓
FilterSpec + 4 SearchObjects (3–5 keywords, category, 75–100% price wall)
        ↓
Dual catalog
  • curated / imported products (Dominique columns)
  • Amazon HTML search (Creators API later)
        ↓
Hard filters (budget, blacklist, age, relationship)
Soft drop: Wear → interests → personality (never drop budget/age/relationship/blacklist)
        ↓
ENGINE_USE_AI? Claude final 4 + tips : local scoreGiftFit
        ↓
BUY THIS links · train on buy_click only
```

## Config

| Env | Meaning |
| --- | --- |
| `ENGINE_MODE=gift-brain` | Primary path |
| `ENGINE_USE_AI=false` | Kill-switch for Claude final pick |
| `ENGINE_CATALOG_MODE=both` | `both` \| `amazon` \| `local` |
| `AMAZON_PARTNER_TAG` | Associates tag on `/dp/ASIN` |

## Catalog import

```bash
npm run db:migrate
npm run engine:import-catalog -- path/to/batch.csv
```

CSV columns: `id,title,price,buy_url,occasion,price_tier,relationship,parent_type,wear_use_do,age_groups,tags,...`

## Key modules

| Path | Role |
| --- | --- |
| `../questionnaire/` | Path-routed questions (edit copy in `config.ts`) |
| `brain/search-object.ts` | 4 slot search objects |
| `brain/filters.ts` | Catalog filter order + fallback |
| `stores/curated-search.server.ts` | Local/import adapter |
| `stores/amazon-search.server.ts` | Amazon HTML (+ Creators later) |
| `ai/final-picker.server.ts` | Optional Claude final pick |
| `keywords/blocklist.ts` | Dominique block rules in code |
