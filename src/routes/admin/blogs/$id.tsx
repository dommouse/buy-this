import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getBlogAdmin, saveBlog } from "@/admin/modules/blogs/blogs.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner, ButtonSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/blogs/$id")({
  component: BlogEditPage,
});

function BlogEditPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content_html: "",
    cover_url: "",
    status: "draft" as "draft" | "published",
    sort_order: 0,
    seo_title: "",
    seo_description: "",
  });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getBlogAdmin({ data: { id } });
        if (cancelled) return;
        setForm({
          title: row.title,
          slug: row.slug,
          excerpt: row.excerpt,
          content_html: row.content_html,
          cover_url: row.cover_url || "",
          status: row.status,
          sort_order: row.sort_order,
          seo_title: row.seo_title || "",
          seo_description: row.seo_description || "",
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load blog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  if (loading) return <AdminSpinner />;

  return (
    <div>
      <AdminPageHeader
        title={isNew ? "New blog" : "Edit blog"}
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/blogs">Back</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Slug (optional)</Label>
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Excerpt</Label>
          <Textarea rows={2} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Cover image URL</Label>
          <Input value={form.cover_url} onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>Content (HTML)</Label>
          <Textarea
            rows={16}
            className="font-mono text-xs"
            value={form.content_html}
            onChange={(e) => setForm((f) => ({ ...f, content_html: e.target.value }))}
            placeholder="<p>Write your post…</p>"
          />
          <p className="text-xs text-muted-foreground">
            Store unlimited HTML content. You can paste from any rich editor. Preview on the public blog page after publishing.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as "draft" | "published" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Sort order</Label>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>SEO title</Label>
          <Input value={form.seo_title} onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>SEO description</Label>
          <Textarea
            rows={2}
            value={form.seo_description}
            onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
          />
        </div>
        <Button
          disabled={busy || !form.title}
          onClick={async () => {
            setBusy(true);
            try {
              const row = await saveBlog({
                data: {
                  ...(isNew ? {} : { id }),
                  title: form.title,
                  slug: form.slug || undefined,
                  excerpt: form.excerpt,
                  content_html: form.content_html,
                  cover_url: form.cover_url || null,
                  status: form.status,
                  sort_order: form.sort_order,
                  seo_title: form.seo_title || null,
                  seo_description: form.seo_description || null,
                },
              });
              toast.success("Blog saved");
              if (isNew) await navigate({ to: "/admin/blogs/$id", params: { id: row.id } });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Save failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <ButtonSpinner /> : null}
          Save blog
        </Button>
      </div>
    </div>
  );
}
