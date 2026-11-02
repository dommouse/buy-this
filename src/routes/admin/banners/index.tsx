import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BannerImageField } from "@/admin/components/banner-image-field";
import { deleteBanner, listBannersAdmin, saveBanner } from "@/admin/modules/banners/banners.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/admin/banners/")({
  component: BannersAdminPage,
});

type Banner = Awaited<ReturnType<typeof listBannersAdmin>>[number];

const emptyForm = {
  id: "" as string | undefined,
  title: "",
  description: "",
  image_url: "",
  link_url: "/questionnaire",
  cta_label: "Find a gift",
  sort_order: 0,
  is_active: true,
};

function BannersAdminPage() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    setRows(await listBannersAdmin());
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load banners");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.image_url.trim()) {
      toast.error("Please upload a banner image");
      return;
    }
    setBusy(true);
    try {
      await saveBanner({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title,
          description: form.description,
          image_url: form.image_url,
          link_url: form.link_url,
          cta_label: form.cta_label,
          sort_order: form.sort_order,
          is_active: form.is_active,
        },
      });
      toast.success(form.id ? "Banner updated" : "Banner created");
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Banners"
        description="Homepage hero slider. Active banners auto-rotate on the public home page."
      />

      <form onSubmit={onSave} className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">{form.id ? "Edit banner" : "New banner"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="sm:col-span-2">
            <BannerImageField
              value={form.image_url}
              disabled={busy}
              onChange={(image_url) => setForm({ ...form, image_url })}
            />
          </div>
          <div className="space-y-1">
            <Label>Link URL</Label>
            <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Link Label</Label>
            <Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label>Active</Label>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !form.image_url}>
            {busy ? <ButtonSpinner /> : null}
            {form.id ? "Update" : "Create"}
          </Button>
          {form.id ? (
            <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <AdminSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <img src={row.image_url} alt="" className="h-12 w-20 rounded object-cover" />
                  </td>
                  <td className="px-3 py-2 font-medium">{row.title || "—"}</td>
                  <td className="px-3 py-2">{row.sort_order}</td>
                  <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            image_url: row.image_url,
                            link_url: row.link_url,
                            cta_label: row.cta_label,
                            sort_order: row.sort_order,
                            is_active: row.is_active,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Delete this banner?",
                            text: "It will no longer appear on the landing page.",
                            confirmButtonText: "Delete",
                          });
                          if (!ok) return;
                          try {
                            await deleteBanner({ data: { id: row.id } });
                            toast.success("Deleted");
                            await refresh();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
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
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No banners yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
