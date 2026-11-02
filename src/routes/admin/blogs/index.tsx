import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteBlog, listBlogsAdmin, reorderBlog } from "@/admin/modules/blogs/blogs.functions";
import { AdminPageHeader } from "@/admin/components/page-header";
import { AdminSpinner } from "@/admin/components/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDialog } from "@/lib/confirm-dialog";

export const Route = createFileRoute("/admin/blogs/")({
  component: BlogsAdminPage,
});

type BlogRow = Awaited<ReturnType<typeof listBlogsAdmin>>[number];

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BlogsAdminPage() {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listBlogsAdmin());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <AdminPageHeader
        title="Blogs"
        description="Create and order posts shown on the public site."
        actions={
          <Button asChild>
            <Link to="/admin/blogs/$id" params={{ id: "new" }}>
              New blog
            </Link>
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
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Creator</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Views</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Input
                      className="w-20"
                      type="number"
                      defaultValue={r.sort_order}
                      disabled={busy}
                      onBlur={async (e) => {
                        const sort_order = Number(e.target.value) || 0;
                        if (sort_order === r.sort_order) return;
                        setBusy(true);
                        try {
                          await reorderBlog({ data: { id: r.id, sort_order } });
                          await load();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Reorder failed");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 capitalize">{r.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(r as { admin_users?: { name?: string } | null }).admin_users?.name || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmtDate(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmtDate(r.updated_at)}
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {typeof r.view_count === "number" ? r.view_count : 0}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/admin/blogs/$id" params={{ id: r.id }}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          const ok = await confirmDialog({
                            title: "Delete this blog?",
                            text: "This cannot be undone.",
                            confirmButtonText: "Delete",
                          });
                          if (!ok) return;
                          setBusy(true);
                          try {
                            await deleteBlog({ data: { id: r.id } });
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
                    No blogs yet
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
