import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getGiftBrainSettings, saveGiftBrainSettings } from "@/admin/modules/settings/settings.functions";
import type { SettingsMap, SettingValue } from "@/admin/lib/settings.server";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AVOID_CATEGORY_OPTIONS } from "@/admin/lib/avoid-categories";

export const Route = createFileRoute("/admin/gift-brain")({
  component: GiftBrainConfigPage,
});

const AVOID_OPTIONS = AVOID_CATEGORY_OPTIONS;

function GiftBrainConfigPage() {
  const [form, setForm] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setForm(await getGiftBrainSettings());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <AdminSpinner />;
  if (!form) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Could not load Gift Brain settings.</p>
        <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  const bool = (key: string) => Boolean(form[key]);
  const str = (key: string) => String(form[key] ?? "");

  function set(key: string, value: SettingValue) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  const avoidSelected = new Set(
    str("ENGINE_AVOID_CATEGORIES")
      .split(/[,|]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  function addAvoid(id: string) {
    if (!id || avoidSelected.has(id)) return;
    set("ENGINE_AVOID_CATEGORIES", [...avoidSelected, id].join(","));
  }

  function removeAvoid(id: string) {
    const next = [...avoidSelected].filter((x) => x !== id);
    set("ENGINE_AVOID_CATEGORIES", next.join(","));
  }

  const avoidAvailable = AVOID_OPTIONS.filter((o) => !avoidSelected.has(o.id));

  return (
    <div>
      <AdminPageHeader
        title="Gift Brain"
        description="Runtime engine toggles. Changes apply without restart (DB overrides env)."
      />
      <Card className="glass-panel border-white/50">
        <CardContent className="space-y-5 pt-6">
          {(
            [
              ["ENGINE_ENABLED", "Engine enabled"],
              ["ENGINE_USE_AI", "Use Claude final pick"],
              ["ENGINE_TRAINING_ENABLED", "Training enabled"],
              ["AMAZON_ASSOCIATES_ENABLED", "Amazon Associates enabled"],
              ["SKIMLINKS_ENABLED", "Skimlinks enabled"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label>{label}</Label>
              <Switch checked={bool(key)} onCheckedChange={(v) => set(key, v)} />
            </div>
          ))}

          <div className="space-y-1">
            <Label>Engine mode</Label>
            <Select value={str("ENGINE_MODE") || "gift-brain"} onValueChange={(v) => set("ENGINE_MODE", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gift-brain">gift-brain</SelectItem>
                <SelectItem value="keyword-search">keyword-search</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Catalog mode</Label>
            <Select
              value={str("ENGINE_CATALOG_MODE") || "both"}
              onValueChange={(v) => set("ENGINE_CATALOG_MODE", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select catalog mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">both</SelectItem>
                <SelectItem value="amazon">amazon</SelectItem>
                <SelectItem value="local">local</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Recommendation count</Label>
              <Select
                value={String(form["ENGINE_RECOMMENDATION_COUNT"] ?? 12)}
                onValueChange={(v) => set("ENGINE_RECOMMENDATION_COUNT", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 8, 12, 16, 20, 24].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Page size</Label>
              <Select
                value={String(form["ENGINE_PAGE_SIZE"] ?? 4)}
                onValueChange={(v) => set("ENGINE_PAGE_SIZE", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Max recommendation ms</Label>
              <Select
                value={String(form["ENGINE_MAX_RECOMMENDATION_MS"] ?? 90000)}
                onValueChange={(v) => set("ENGINE_MAX_RECOMMENDATION_MS", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30000, 60000, 90000, 120000].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n.toLocaleString()} ms
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Train every (minutes)</Label>
              <Select
                value={String(form["ENGINE_TRAIN_EVERY_MINUTES"] ?? 30)}
                onValueChange={(v) => set("ENGINE_TRAIN_EVERY_MINUTES", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[15, 30, 60, 120].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Event retention days</Label>
              <Select
                value={String(form["ENGINE_EVENT_RETENTION_DAYS"] ?? 180)}
                onValueChange={(v) => set("ENGINE_EVENT_RETENTION_DAYS", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 90, 180, 365].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Amazon partner tag</Label>
            <Input
              value={str("AMAZON_PARTNER_TAG")}
              onChange={(e) => set("AMAZON_PARTNER_TAG", e.target.value)}
              placeholder="yourtag-20"
            />
          </div>

          <div className="space-y-2">
            <Label>Avoid categories</Label>
            <p className="text-xs text-muted-foreground">
              Add categories the engine should never recommend. Pick from the dropdown to avoid duplicates.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                key={`avoid-${[...avoidSelected].join("|")}`}
                onValueChange={(v) => addAvoid(v)}
                disabled={!avoidAvailable.length}
              >
                <SelectTrigger className="sm:max-w-xs">
                  <SelectValue
                    placeholder={avoidAvailable.length ? "Add a category…" : "All categories added"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {avoidAvailable.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ul className="divide-y rounded-lg border border-border/60 bg-white/40">
              {[...avoidSelected].map((id) => {
                const opt = AVOID_OPTIONS.find((o) => o.id === id);
                return (
                  <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{opt?.label || id}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeAvoid(id)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
              {!avoidSelected.size ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No avoided categories yet — add one from the dropdown.
                </li>
              ) : null}
            </ul>
          </div>

          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await saveGiftBrainSettings({ data: form });
                setForm(saved);
                toast.success("Gift Brain settings saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <ButtonSpinner /> : null}
            Save Gift Brain settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
