import { engineConfig } from "../config";
import { amazonSearchAdapter } from "./amazon-search.server";
import { curatedSearchAdapter } from "./curated-search.server";
import type { StoreSearchAdapter } from "./types";

/**
 * Active store adapters for product search.
 * ENGINE_CATALOG_MODE: both | amazon | local
 */
export function getActiveStoreAdapters(): StoreSearchAdapter[] {
  const mode = engineConfig.catalogMode;
  const stores: StoreSearchAdapter[] = [];
  if (mode === "both" || mode === "local") stores.push(curatedSearchAdapter);
  if ((mode === "both" || mode === "amazon") && engineConfig.amazon.enabled) {
    stores.push(amazonSearchAdapter);
  }
  return stores;
}
