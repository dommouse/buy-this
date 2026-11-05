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

export const Route = createFileRoute("/admin/gift-brain")({
  component: GiftBrainConfigPage,
});

function GiftBrainConfigPage() {
  const [form, setForm] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avoidDraft, setAvoidDraft] = useState("");

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

  const avoidList = str("ENGINE_AVOID_CATEGORIES")
    .split(/[,|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const avoidSelectedLower = new Set(avoidList.map((s) => s.toLowerCase()));

  function addAvoid(raw: string) {
    const parts = raw
      .split(/[,|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...avoidList];
    let added = 0;
    for (const part of parts) {
      if (avoidSelectedLower.has(part.toLowerCase()) || next.some((x) => x.toLowerCase() === part.toLowerCase())) {
        continue;
      }
      next.push(part);
      added += 1;
    }
    if (!added) {
      toast.error("That category is already in the list");
      return;
    }
    set("ENGINE_AVOID_CATEGORIES", next.join(","));
    setAvoidDraft("");
  }

  function removeAvoid(value: string) {
    const next = avoidList.filter((x) => x.toLowerCase() !== value.toLowerCase());
    set("ENGINE_AVOID_CATEGORIES", next.join(","));
  }

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
              Type a category or keyword the engine should never recommend (e.g. candles, wallets). Press
              Enter or Add. Comma-separated values are supported.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={avoidDraft}
                onChange={(e) => setAvoidDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAvoid(avoidDraft);
                  }
                }}
                placeholder="e.g. candles, perfume, kitchen gadgets"
                className="sm:max-w-md"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!avoidDraft.trim()}
                onClick={() => addAvoid(avoidDraft)}
              >
                Add
              </Button>
            </div>
            <ul className="divide-y rounded-lg border border-border/60 bg-white/40">
              {avoidList.map((value) => (
                <li key={value.toLowerCase()} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="capitalize">{value}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeAvoid(value)}>
                    Remove
                  </Button>
                </li>
              ))}
              {!avoidList.length ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No avoided categories yet — type one above and click Add.
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
