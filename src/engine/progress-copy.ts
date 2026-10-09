/**
 * Turn raw engine log lines into short, friendly status copy for the results UI.
 * Returns null when the log is too internal to show users.
 */
export function toUserProgress(message: string): string | null {
  const m = message.replace(/^engine:\s*/i, "").trim();
  if (!m) return null;

  // Recommend lifecycle
  if (/^recommend start/i.test(m)) return "Reading your answers…";
  if (/^disabled/i.test(m)) return "Gift brain is paused — trying a safe fallback…";
  if (/keyword-search ok/i.test(m)) {
    const n = m.match(/(\d+)\s*gifts/i)?.[1];
    return n ? `Locked in ${n} personalized picks.` : "Locked in your personalized picks.";
  }
  if (/claude-suggest ok/i.test(m)) return "Gift ideas are ready.";
  if (/finalize strategy=/i.test(m)) {
    const n = m.match(/gifts=(\d+)/i)?.[1];
    return n ? `Wrapping up ${n} gift${n === "1" ? "" : "s"} for you…` : "Wrapping up your gift shortlist…";
  }

  // Phrases / bounds
  if (/building search phrases|build(ing)? slot phrases/i.test(m)) {
    return "Crafting smart search phrases for each gift slot…";
  }
  if (/^search phrases/i.test(m)) return "Search phrases ready — hunting real products…";
  if (/^answer bounds/i.test(m)) return "Applying age, budget & preference bounds…";
  if (/phrase blocked/i.test(m)) return "Skipping a too-common gift idea — trying a fresher angle…";
  if (/giving up on/i.test(m)) return "Moving on from a blocked idea to keep things interesting…";
  if (/all search phrases blocked/i.test(m)) return "Rethinking every angle — those first ideas were too ordinary…";

  // Per-slot search
  if (/batch searching all slots/i.test(m)) return "Searching all gift slots in one pass…";
  if (/searching (slot |for )?/i.test(m) || /searching amazon for/i.test(m)) {
    const slot = m.match(/The (One|Wow|Smart Pick|Wildcard)/i)?.[0];
    return slot ? `Searching catalogs for ${slot}…` : "Searching product catalogs…";
  }
  if (/candidates passed live checks/i.test(m)) {
    const n = Number(m.match(/(\d+) candidates passed/i)?.[1] ?? 0);
    return n === 0
      ? "No live matches yet — widening search parameters…"
      : `${n} products passed live checks.`;
  }
  if (/validating (\d+) candidates across/i.test(m)) {
    const n = m.match(/validating (\d+)/i)?.[1];
    return n ? `Checking ${n} products in parallel…` : "Checking products in parallel…";
  }
  if (/fewer than 4 validated/i.test(m)) return "Only a few matches — widening search for more…";
  if (/found (\d+) raw/i.test(m)) {
    const n = Number(m.match(/found (\d+) raw/i)?.[1] ?? 0);
    const slot = m.match(/for (.+?)(?:\s*$)/i)?.[1]?.replace(/\s*—.*$/, "").trim();
    if (n === 0) {
      return slot
        ? `No hits yet for ${slot} — widening the search…`
        : "No products yet — widening the search…";
    }
    return slot ? `Found ${n} product${n === 1 ? "" : "s"} for ${slot}.` : `Found ${n} products.`;
  }
  if (/validating (\d+)/i.test(m)) {
    const n = m.match(/validating (\d+)/i)?.[1];
    return n ? `Checking ${n} live product page${n === "1" ? "" : "s"}…` : "Validating live product pages…";
  }
  if (/has (\d+) validated candidates/i.test(m)) {
    const n = Number(m.match(/has (\d+) validated candidates/i)?.[1] ?? 0);
    const slot = m.match(/^(The (?:One|Wow|Smart Pick|Wildcard))/i)?.[1];
    if (n === 0) {
      return slot ? `Still empty for ${slot} — expanding search parameters…` : "Expanding search parameters…";
    }
    return slot
      ? `${slot}: ${n} solid match${n === 1 ? "" : "es"} passed the checks.`
      : `${n} gifts passed live checks.`;
  }
  if (/no validated products/i.test(m)) {
    const slot = m.match(/^(The (?:One|Wow|Smart Pick|Wildcard))/i)?.[1];
    return slot
      ? `${slot} came up empty — widening search & trying again…`
      : "Empty results — widening search parameters…";
  }
  if (/widen(ing)? search/i.test(m)) {
    const slot = m.match(/for (The (?:One|Wow|Smart Pick|Wildcard))/i)?.[1];
    return slot
      ? `Widening search for ${slot} (broader keywords & budget band)…`
      : "Widening search parameters for better coverage…";
  }
  if (/widen(ed)? found (\d+)/i.test(m)) {
    const n = Number(m.match(/found (\d+)/i)?.[1] ?? 0);
    return n > 0
      ? `Wider search found ${n} more option${n === 1 ? "" : "s"}.`
      : "Wider search still thin — trying the next slot…";
  }

  // Picking / validation
  if (/picking best|slot pick|curating/i.test(m)) return "Choosing The One, The Wow, Smart Pick & Wildcard…";
  if (/final validation|keyword picks failed/i.test(m)) {
    if (/failed/i.test(m)) return "Double-checking links — swapping any that didn’t pass…";
    return "Final quality check on every BUY THIS link…";
  }
  if (/store search returned no products/i.test(m)) {
    return "Catalog came up quiet — switching strategy…";
  }
  if (/falling back/i.test(m)) return "Switching to a backup gift strategy…";
  if (/emergency catalog|filling from emergency/i.test(m)) {
    return "Topping up the shortlist with trusted catalog picks…";
  }
  if (/only (\d+) gifts/i.test(m)) {
    const n = m.match(/only (\d+) gifts/i)?.[1];
    return n ? `Only ${n} so far — searching for more that fit…` : "Gathering a few more matching gifts…";
  }

  // Drops (keep short + positive)
  if (/dropping gender-mismatched/i.test(m)) return "Filtering out gifts that don’t match their gender…";
  if (/dropping avoided category/i.test(m)) return "Skipping common fillers (candles, perfume, wallets…)…";
  if (/dropping.*ASIN|without live ASIN|dead ASIN|unknown ASIN/i.test(m)) {
    return "Removing products that aren’t live buyable pages…";
  }
  if (/dropping Amazon search URL|non-PDP|stripping/i.test(m)) {
    return "Keeping only real product pages — no search-result links…";
  }
  if (/retrying Claude after TLS/i.test(m)) return "Reconnecting to the gift brain…";
  if (/no store adapters/i.test(m)) return "Store search isn’t available — using a backup path…";

  // Generic fallbacks for unknown but user-safe lines
  if (/^dropping /i.test(m)) return "Refining the shortlist…";
  if (/failed/i.test(m)) return "Hit a snag — recovering and continuing…";

  return null;
}

/** Always returns something readable for the UI status line. */
export function toUserProgressOrFallback(message: string, fallback = "Working on your gifts…"): string {
  return toUserProgress(message) || fallback;
}
