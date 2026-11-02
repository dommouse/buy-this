import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BannerImageField } from "@/admin/components/banner-image-field";
import { isPendingBannerDataUrl } from "@/admin/lib/banner-image";
import {
  deleteBanner,
  listBannersAdmin,
  saveBanner,
  uploadBannerImage,
} from "@/admin/modules/banners/banners.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  id: undefined as string | undefined,
  title: "",
  description: "",
  /** Display / preview (server path or local data URL). */
  image_url: "",
  link_url: "/questionnaire",
  cta_label: "Find a gift",
  sort_order: 0,
  is_active: true,
};

type BannerForm = typeof emptyForm;

function BannersAdminPage() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyForm);

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

  function openNew() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(row: Banner) {
    setForm({
      id: row.id,
      title: row.title,
      description: row.description,
      image_url: row.image_url,
      link_url: row.link_url,
      cta_label: row.cta_label,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setModalOpen(false);
    setForm(emptyForm);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.image_url.trim()) {
      toast.error("Please add a banner image");
      return;
    }
    setBusy(true);
    try {
      let imageUrl = form.image_url.trim();
      if (isPendingBannerDataUrl(imageUrl)) {
        const uploaded = await uploadBannerImage({
          data: {
            dataUrl: imageUrl,
            filename: `banner-${Date.now()}.jpg`,
          },
        });
        imageUrl = uploaded.url;
      }

      await saveBanner({
        data: {
          ...(form.id ? { id: form.id } : {}),
          title: form.title.trim(),
          description: form.description,
          image_url: imageUrl,
          link_url: form.link_url.trim(),
          cta_label: form.cta_label.trim(),
          sort_order: form.sort_order,
          is_active: form.is_active,
        },
      });
      toast.success(form.id ? "Banner updated" : "Banner created");
      setModalOpen(false);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Banners"
        description="Homepage hero slider. Active banners auto-rotate on the public home page."
        actions={
          <Button type="button" onClick={openNew}>
            New Banner
          </Button>
        }
      />

      {loading ? (
        <AdminSpinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Link</th>
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
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted-foreground" title={row.link_url}>
                    {row.link_url || "—"}
                  </td>
                  <td className="px-3 py-2">{row.sort_order}</td>
                  <td className="px-3 py-2">{row.is_active ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
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
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Delete failed");
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
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No banners yet. Click New Banner to create one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(open) => (open ? setModalOpen(true) : closeModal())}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                disabled={busy}
              />
            </div>
            <BannerImageField
              value={form.image_url}
              disabled={busy}
              onChange={(image_url) => setForm({ ...form, image_url })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Link URL</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://… or /questionnaire"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">Long product URLs are supported (up to 4,000 characters).</p>
              </div>
              <div className="space-y-1">
                <Label>Link Label</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                  disabled={busy}
                />
              </div>
              <div className="flex items-center justify-between gap-4 sm:col-span-2">
                <Label>Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  disabled={busy}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !form.image_url || !form.title.trim()}>
                {busy ? <ButtonSpinner /> : null}
                {form.id ? "Update banner" : "Create banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
