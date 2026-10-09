import { engineConfig } from "../config";
import { amazonSearchAdapter } from "./amazon-search.server";
import type { StoreSearchAdapter } from "./types";

/**
 * Active store adapters for product search.
 * Add Nordstrom / Etsy / Target / Macy's adapters here later —
 * keyword engine does not change.
 */
export function getActiveStoreAdapters(): StoreSearchAdapter[] {
  const stores: StoreSearchAdapter[] = [];
  if (engineConfig.amazon.enabled) stores.push(amazonSearchAdapter);
  // Future: if (engineConfig.nordstrom.enabled) stores.push(nordstromAdapter);
  return stores;
}
