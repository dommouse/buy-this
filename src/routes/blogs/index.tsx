import { Link, createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { useEffect, useState } from "react";

import { listPublishedBlogs } from "@/admin/modules/blogs/blogs.functions";
import { AdminSpinner } from "@/admin/components/loading";
import { PortalShell } from "@/components/portal/portal-shell";

export const Route = createFileRoute("/blogs/")({
  head: () => ({
    meta: [
      { title: "Blog — BUY THIS" },
      { name: "description", content: "Gift guides and relationship tips from BUY THIS." },
    ],
  }),
  component: BlogsIndexPage,
});

function BlogsIndexPage() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listPublishedBlogs>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await listPublishedBlogs({ data: { limit: 48 } }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load blogs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PortalShell title="Blog">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Insights</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Blog</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Gift guides, occasion playbooks, and thoughtful ideas from the BUY THIS team.
          </p>
        </header>

        {loading ? <AdminSpinner /> : null}
        {error ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((b) => {
            const author =
              (b as { admin_users?: { name?: string } | null }).admin_users?.name || "BUY THIS";
            const date = b.published_at
              ? new Date(b.published_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;
            return (
              <Link
                key={b.id}
                to="/blogs/$slug"
                params={{ slug: b.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/50 bg-white/45 shadow-sm transition-all hover:-translate-y-1 hover:bg-white/70 hover:shadow-md"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-primary/5">
                  {b.cover_url ? (
                    <img
                      src={b.cover_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-primary/35">
                      <Gift className="size-12" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {date}
                    {date ? " · " : null}
                    {author}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary">
                    {b.title}
                  </h2>
                  {b.excerpt ? (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                      {b.excerpt}
                    </p>
                  ) : null}
                  <span className="mt-4 text-sm font-semibold text-primary">Read article →</span>
                </div>
              </Link>
            );
          })}
        </div>

        {!loading && !rows.length ? (
          <p className="mt-10 text-sm text-muted-foreground">No posts published yet.</p>
        ) : null}
      </div>
    </PortalShell>
  );
}
