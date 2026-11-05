import { Link, createFileRoute } from "@tanstack/react-router";
import { Gift, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { listActiveBanners } from "@/admin/modules/banners/banners.functions";
import { listPublishedBlogs } from "@/admin/modules/blogs/blogs.functions";
import logoUrl from "@/assets/relationship-concierge-logo.png";
import { BannerSlider, type BannerSlide } from "@/components/portal/banner-slider";
import { PortalShell } from "@/components/portal/portal-shell";
import { ScrollReveal } from "@/components/portal/scroll-reveal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BUY THIS — AI Gift Concierge" },
      {
        name: "description",
        content: "Find the perfect gift for every person and every occasion with BUY THIS.",
      },
      { property: "og:title", content: "BUY THIS — AI Gift Concierge" },
      {
        property: "og:description",
        content: "Every person. Every occasion. The perfect gift.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [banners, setBanners] = useState<BannerSlide[]>([]);
  const [blogs, setBlogs] = useState<Awaited<ReturnType<typeof listPublishedBlogs>>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [b, posts] = await Promise.all([
          listActiveBanners(),
          listPublishedBlogs({ data: { limit: 10 } }),
        ]);
        setBanners(b);
        setBlogs(posts);
      } catch {
        /* keep empty fallbacks */
      }
    })();
  }, []);

  return (
    <PortalShell landing>
      {/* 1. Find Gift / BUY THIS */}
      <section id="find-a-gift" className="scroll-mt-16 px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
        <ScrollReveal>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/questionnaire";
            }}
            className="glass-panel group mx-auto flex w-full max-w-6xl flex-col rounded-3xl p-6 text-left transition-all hover:bg-white/60 sm:p-10 lg:p-12"
          >
            <div className="mb-8 flex justify-center sm:mb-10">
              <img
                src={logoUrl}
                alt="Relationship Concierge"
                className="h-40 w-auto max-w-[480px] object-contain sm:h-52 sm:max-w-[560px] lg:h-56"
              />
            </div>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Gift className="size-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="size-3.5" />
                  Buy This
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Not sure what to buy them?
                </h2>
                <p className="mt-2 max-w-3xl text-pretty text-base leading-7 text-muted-foreground">
                  Walk through a short scenario about who they are, the occasion, and your budget. We turn
                  those answers into a focused shortlist of gifts you can open and buy.
                </p>
              </div>
              <Button asChild size="lg" className="pointer-events-none shrink-0 font-bold uppercase">
                <span>Buy This</span>
              </Button>
            </div>
          </button>
        </ScrollReveal>
      </section>

      {/* 2. Banner slider — content width, rounded */}
      <section id="banners" className="scroll-mt-16 px-4 pb-12 sm:px-6 sm:pb-16 lg:px-10">
        <ScrollReveal delayMs={40}>
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5">
            <BannerSlider slides={banners} contained />
          </div>
        </ScrollReveal>
      </section>

      {/* 3. Blogs */}
      <section id="blogs" className="scroll-mt-16 border-t border-white/40 bg-white/25 px-4 py-16 sm:px-6 lg:px-10">
        <ScrollReveal delayMs={80}>
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">From the blog</h2>
                <p className="mt-1 text-sm text-muted-foreground">Guides and ideas worth saving.</p>
              </div>
              <Link to="/blogs" className="shrink-0 text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {blogs.map((b, i) => (
                <ScrollReveal key={b.id} delayMs={40 * (i % 3)}>
                  <Link
                    to="/blogs/$slug"
                    params={{ slug: b.slug }}
                    className="glass-panel flex h-full flex-col overflow-hidden rounded-2xl transition-transform hover:-translate-y-1"
                  >
                    {b.cover_url ? (
                      <img src={b.cover_url} alt="" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-primary/5 text-primary/40">
                        <Gift className="size-10" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold text-foreground">{b.title}</h3>
                      {b.excerpt ? (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{b.excerpt}</p>
                      ) : null}
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
            {!blogs.length ? (
              <p className="mt-6 text-sm text-muted-foreground">No published posts yet — check back soon.</p>
            ) : null}
          </div>
        </ScrollReveal>
      </section>
    </PortalShell>
  );
}
