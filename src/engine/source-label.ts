/** Client-safe store badge helper (no process.env / server config). */

export function productSourceLabel(provider: string, buyUrl: string): { id: string; label: string } {
  const url = buyUrl || "";
  if (provider === "amazon" || /amazon\./i.test(url)) {
    return { id: "amazon", label: "Amazon" };
  }
  if (provider === "skimlinks" || /skimresources|skimlinks/i.test(url)) {
    return { id: "partner", label: "Partner store" };
  }
  if (provider === "claude" || provider === "starter") {
    return { id: "curated", label: "Curated pick" };
  }
  if (provider) {
    return { id: provider, label: provider.charAt(0).toUpperCase() + provider.slice(1) };
  }
  return { id: "store", label: "Online store" };
}
