import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  catalogRowsToWorkbook,
  isProperBuyUrl,
  parseCatalogWorkbookDetailed,
} from "@/admin/lib/catalog-excel";
import {
  clearDeadCatalog,
  deleteGiftCatalogItem,
  exportGiftCatalog,
  importGiftCatalogRows,
  listGiftCatalog,
  markCatalogDead,
  syncCatalogToBrain,
  upsertGiftCatalogItem,
  validateCatalogBuyLink,
  validateCatalogBuyLinksBatch,
} from "@/admin/modules/catalog/catalog.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
  finishImportProgress,
  openImportProgress,
  updateImportProgress,
} from "@/lib/import-progress";

export const Route = createFileRoute("/admin/catalog/")({
  component: CatalogPage,
});

type Row = Awaited<ReturnType<typeof listGiftCatalog>>[number];

function CatalogPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: "" as string | undefined,
    sku: "",
    title: "",
    description: "",
    retailer: "Amazon",
    price_tier: "$$",
    occasion: "",
    relationship: "",
    gender: "",
    category: "",
    status: "pending",
    buy_url: "",
    tags: "",
    slot: "",
    gift_note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listGiftCatalog({ data: { q, dead: "all" } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onImport(file: File) {
    setBusy(true);
    await openImportProgress("Importing catalog");
    try {
      await updateImportProgress("Reading file", `Loading “${file.name}” into memory…`, 5);
      const buf = await file.arrayBuffer();

      await updateImportProgress(
        "Parsing spreadsheet",
        "Reading all sheets and mapping gift rows. This may take a moment…",
        12,
      );
      // Run parse off the current tick so the modal can paint first
      const parsedDetail = await new Promise<ReturnType<typeof parseCatalogWorkbookDetailed>>(
        (resolve, reject) => {
          setTimeout(() => {
            try {
              resolve(parseCatalogWorkbookDetailed(buf));
            } catch (err) {
              reject(err);
            }
          }, 30);
        },
      );
      const parsed = parsedDetail.rows;

      if (!parsed.length) {
        throw new Error(
          parsedDetail.skippedNoBuyUrl
            ? `No rows with a proper buy link found (${parsedDetail.skippedNoBuyUrl} skipped).`
            : "No valid rows found in spreadsheet",
        );
      }

      await updateImportProgress(
        "Preparing sync",
        `Found ${parsed.length.toLocaleString()} gifts with buy links` +
          (parsedDetail.skippedNoBuyUrl
            ? ` · skipped ${parsedDetail.skippedNoBuyUrl.toLocaleString()} without a link`
            : "") +
          `. Uploading in batches…`,
        18,
      );

      const chunkSize = 100;
      const totalChunks = Math.ceil(parsed.length / chunkSize);
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const pct = 18 + Math.round((chunkIndex / totalChunks) * 72);
        await updateImportProgress(
          `Syncing batch ${chunkIndex} of ${totalChunks}`,
          `Saving rows ${(i + 1).toLocaleString()}–${(i + chunk.length).toLocaleString()} of ${parsed.length.toLocaleString()} to the catalog…`,
          pct,
        );
        const isLast = chunkIndex === totalChunks;
        const res = await importGiftCatalogRows({
          data: { rows: chunk, finalize: isLast },
        });
        created += res.created;
        updated += res.updated;
        skipped += res.skipped;
        errors.push(...res.errors);
      }

      await updateImportProgress("Refreshing list", "Reloading catalog in the admin table…", 95);
      await load();

      await finishImportProgress({
        ok: true,
        title: "Import complete",
        text: `${created.toLocaleString()} created · ${updated.toLocaleString()} updated · ${skipped.toLocaleString()} skipped (${parsed.length.toLocaleString()} rows)`,
      });
      if (errors.length) toast.message(errors.slice(0, 3).join(" · "));
    } catch (e) {
      await finishImportProgress({
        ok: false,
        title: "Import failed",
        text: e instanceof Error ? e.message : "Import failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onExport() {
    setBusy(true);
    try {
      const data = await exportGiftCatalog();
      const buf = catalogRowsToWorkbook(data as Record<string, unknown>[]);
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gift-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onValidateOne(id: string, sku: string) {
    setBusy(true);
    await openImportProgress("Validating buy link");
    try {
      await updateImportProgress("Checking product", `Validating ${sku}…`, 40);
      const res = await validateCatalogBuyLink({ data: { id } });
      await load();
      await finishImportProgress({
        ok: res.alive,
        title: res.alive ? "Product is alive" : "Marked as dead",
        text: `${res.sku}: ${res.reason}`,
      });
    } catch (e) {
      await finishImportProgress({
        ok: false,
        title: "Validation failed",
        text: e instanceof Error ? e.message : "Validation failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onValidateAll() {
    if (!rows.length) {
      toast.message("No catalog rows to validate");
      return;
    }
    const ok = await confirmDialog({
      title: "Validate all buy links?",
      text: `Check ${rows.length} product(s). Alive links stay live; broken or mismatched links are marked dead.`,
      confirmButtonText: "Validate all",
      danger: false,
      icon: "question",
    });
    if (!ok) return;

    setBusy(true);
    await openImportProgress("Validating catalog links");
    try {
      const ids = rows.map((r) => r.id);
      const chunkSize = 15;
      const totalChunks = Math.ceil(ids.length / chunkSize);
      let alive = 0;
      let dead = 0;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const chunkIndex = Math.floor(i / chunkSize) + 1;
        const pct = Math.round((chunkIndex / totalChunks) * 90);
        await updateImportProgress(
          `Checking batch ${chunkIndex} of ${totalChunks}`,
          `Validating products ${(i + 1).toLocaleString()}–${(i + chunk.length).toLocaleString()} of ${ids.length.toLocaleString()}…`,
          pct,
        );
        const res = await validateCatalogBuyLinksBatch({ data: { ids: chunk } });
        alive += res.alive;
        dead += res.dead;
      }

      await updateImportProgress("Refreshing list", "Reloading catalog…", 96);
      await load();
      await finishImportProgress({
        ok: true,
        title: "Validation complete",
        text: `${alive.toLocaleString()} alive · ${dead.toLocaleString()} marked dead`,
      });
    } catch (e) {
      await finishImportProgress({
        ok: false,
        title: "Validation failed",
        text: e instanceof Error ? e.message : "Validation failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Catalog"
        description="Gift Brain catalog — import Excel, manage live/dead products."
        actions={
          <>
            <Button variant="outline" disabled={busy} onClick={() => void onExport()}>
              Export Excel
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = "";
                }}
              />
              <Button asChild disabled={busy}>
                <span>{busy ? "Importing…" : "Import Excel"}</span>
              </Button>
            </label>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setForm({
                  id: undefined,
                  sku: "",
                  title: "",
                  description: "",
                  retailer: "Amazon",
                  price_tier: "$$",
                  occasion: "",
                  relationship: "",
                  gender: "",
                  category: "",
                  status: "pending",
                  buy_url: "",
                  tags: "",
                  slot: "",
                  gift_note: "",
                });
                setOpen(true);
              }}
            >
              Add item
            </Button>
            <Button variant="outline" disabled={busy || !rows.length} onClick={() => void onValidateAll()}>
              Validate all links
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await syncCatalogToBrain();
                  toast.success("Gift Brain catalog cache cleared");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Sync failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sync to Gift Brain
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Clear all dead products?",
                  text: "Every catalog row marked dead will be permanently deleted.",
                  confirmButtonText: "Delete all dead",
                });
                if (!ok) return;
                setBusy(true);
                try {
                  const res = await clearDeadCatalog();
                  toast.success(`Cleared ${res.deleted} dead products`);
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Clear failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Clear dead
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-2">
        <Input className="max-w-sm" placeholder="Search SKU / title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={() => void load()}>
          Search
        </Button>
      </div>

      {loading ? (
        <AdminSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Gift</th>
                <th className="px-3 py-2">Occasion</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Buy URL</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Dead</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-3 py-2 max-w-[240px] truncate font-medium" title={r.title}>
                    {r.title}
                  </td>
                  <td className="px-3 py-2">{r.occasion || "—"}</td>
                  <td className="px-3 py-2">{r.price_tier || "—"}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate text-xs" title={r.buy_url || ""}>
                    {r.buy_url ? (
                      <a
                        href={r.buy_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {r.buy_url}
                      </a>
                    ) : (
                      <span className="text-destructive">Missing</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.is_dead ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setForm({
                            id: r.id,
                            sku: r.sku,
                            title: r.title,
                            description: r.description,
                            retailer: r.retailer,
                            price_tier: r.price_tier || "",
                            occasion: r.occasion,
                            relationship: r.relationship,
                            gender: r.gender,
                            category: r.category,
                            status: r.status,
                            buy_url: r.buy_url,
                            tags: (r.tags || []).join(", "),
                            slot: r.slot,
                            gift_note: r.gift_note,
                          });
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void onValidateOne(r.id, r.sku)}
                      >
                        Validate
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await markCatalogDead({ data: { id: r.id, is_dead: !r.is_dead } });
                            await load();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Update failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {r.is_dead ? "Restore" : "Mark dead"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Delete this catalog row?",
                            text: "This product will be removed from the catalog.",
                            confirmButtonText: "Delete",
                          });
                          if (!ok) return;
                          setBusy(true);
                          try {
                            await deleteGiftCatalogItem({ data: { id: r.id } });
                            await load();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Catalog empty — import an Excel file to get started
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit catalog item" : "Add catalog item"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {(
              [
                ["sku", "SKU / ID number"],
                ["title", "Gift title"],
                ["retailer", "Retailer"],
                ["price_tier", "Price tier"],
                ["occasion", "Occasion"],
                ["relationship", "Gifter / relationship"],
                ["gender", "Gender"],
                ["category", "Category"],
                ["status", "Status"],
                ["slot", "Slot"],
                ["buy_url", "Buy URL *"],
                ["tags", "Tags (comma-separated)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  required={key === "buy_url"}
                  type={key === "buy_url" ? "url" : "text"}
                  placeholder={key === "buy_url" ? "https://www.amazon.com/dp/…" : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
                {key === "buy_url" && form.buy_url && !isProperBuyUrl(form.buy_url) ? (
                  <p className="text-xs text-destructive">Enter a valid http(s) buy link.</p>
                ) : null}
              </div>
            ))}
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Gift note</Label>
              <Textarea
                rows={2}
                value={form.gift_note}
                onChange={(e) => setForm((f) => ({ ...f, gift_note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !form.sku || !form.title || !isProperBuyUrl(form.buy_url)}
              onClick={async () => {
                if (!isProperBuyUrl(form.buy_url)) {
                  toast.error("Buy URL is required and must be a valid http(s) link");
                  return;
                }
                setBusy(true);
                try {
                  await upsertGiftCatalogItem({
                    data: {
                      ...(form.id ? { id: form.id } : {}),
                      sku: form.sku,
                      title: form.title,
                      description: form.description,
                      retailer: form.retailer,
                      price_tier: form.price_tier || null,
                      occasion: form.occasion,
                      relationship: form.relationship,
                      gender: form.gender,
                      category: form.category,
                      status: form.status,
                      buy_url: form.buy_url.trim(),
                      tags: form.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      slot: form.slot,
                      gift_note: form.gift_note,
                    },
                  });
                  toast.success("Saved");
                  setOpen(false);
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Save failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <ButtonSpinner /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
