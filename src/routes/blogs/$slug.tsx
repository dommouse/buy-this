import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { getPublishedBlogBySlug } from "@/admin/modules/blogs/blogs.functions";
import { AdminSpinner } from "@/admin/components/loading";
import { PortalShell } from "@/components/portal/portal-shell";

export const Route = createFileRoute("/blogs/$slug")({
  component: BlogDetailPage,
});

function BlogDetailPage() {
  const { slug } = Route.useParams();
  const [post, setPost] = useState<Awaited<ReturnType<typeof getPublishedBlogBySlug>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setPost(await getPublishedBlogBySlug({ data: { slug } }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const author =
    (post as { admin_users?: { name?: string } | null } | null)?.admin_users?.name || "BUY THIS";
  const date = post?.published_at
    ? new Date(post.published_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <PortalShell title={post?.title || "Blog"}>
      <article className="mx-auto max-w-3xl">
        <Link to="/blogs" className="text-sm font-medium text-primary hover:underline">
          ← All posts
        </Link>
        {loading ? <AdminSpinner /> : null}
        {error ? <p className="mt-6 text-destructive">{error}</p> : null}
        {post ? (
          <>
            <header className="mt-6 border-b border-border/60 pb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Article</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {post.title}
              </h1>
              {post.excerpt ? (
                <p className="mt-4 text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{author}</span>
                {date ? <span aria-hidden>·</span> : null}
                {date ? <time dateTime={post.published_at || undefined}>{date}</time> : null}
              </div>
            </header>

            {post.cover_url ? (
              <figure className="mt-8 overflow-hidden rounded-2xl">
                <img
                  src={post.cover_url}
                  alt=""
                  className="aspect-[2/1] w-full object-cover sm:aspect-[21/9]"
                />
              </figure>
            ) : null}

            <div
              className="prose prose-neutral mt-10 max-w-none prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: post.content_html }}
            />

            <footer className="mt-12 border-t border-border/60 pt-6">
              <Link
                to="/blogs"
                className="inline-flex text-sm font-semibold text-primary hover:underline"
              >
                ← More from the blog
              </Link>
            </footer>
          </>
        ) : null}
      </article>
    </PortalShell>
  );
}
