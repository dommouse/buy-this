/** Prints SQL seed rows for the starter catalog: bun run engine:seed-sql */
import { starterCatalog } from "../catalog/starter-catalog";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
const values = starterCatalog.map(
  (p) => `  (${q(p.id)}, ${q(p.title)}, ${q(p.description)}, ${q(p.category)}, ${p.price}, ${arr(p.tags)}, ${arr(p.ageGroups)}, ${q(p.giftType)}, ${q(p.buyUrl)}, 'starter')`,
);
console.log(
  `insert into public.products (id, title, description, category, price, tags, age_groups, gift_type, buy_url, provider) values\n${values.join(",\n")}\non conflict (id) do nothing;`,
);
