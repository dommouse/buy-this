import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BannerSlide = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  cta_label: string;
};

export function BannerSlider({ slides, intervalMs = 6000 }: { slides: BannerSlide[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs]);

  if (!count) {
    return (
      <section className="relative flex min-h-[56vh] items-end justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/40 px-4 pb-10 pt-16 sm:min-h-[62vh] sm:px-8">
        <div className="banner-glass w-full max-w-3xl p-6 text-center sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Every person. Every occasion.
          </h1>
          <p className="mt-3 text-muted-foreground">The perfect gift — start Find A Gift.</p>
          <Button asChild className="mt-6 font-bold uppercase">
            <a href="/questionnaire">Find A Gift</a>
          </Button>
        </div>
      </section>
    );
  }

  const slide = slides[index]!;

  function go(delta: number) {
    setIndex((i) => (i + delta + count) % count);
  }

  const ctaHref = slide.link_url?.trim() || "/questionnaire";
  const isInternal = ctaHref.startsWith("/");

  return (
    <section className="relative min-h-[56vh] overflow-hidden sm:min-h-[68vh]">
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={cn(
            "absolute inset-0 bg-cover bg-center transition-opacity duration-700",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{ backgroundImage: `url(${s.image_url})` }}
          aria-hidden={i !== index}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        </div>
      ))}

      <div className="relative z-10 flex min-h-[56vh] items-end px-4 pb-14 pt-20 sm:min-h-[68vh] sm:px-8 sm:pb-16 lg:px-12">
        <div className="banner-glass w-full max-w-3xl p-5 sm:p-7">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl">
            {slide.title}
          </h1>
          {slide.description ? (
            <p className="mt-3 text-pretty text-base leading-7 text-white/90 sm:text-lg">{slide.description}</p>
          ) : null}
          <div className="mt-5">
            <Button asChild size="lg" className="font-bold uppercase shadow-md">
              {isInternal ? (
                <a href={ctaHref}>{slide.cta_label || "Find A Gift"}</a>
              ) : (
                <a href={ctaHref} target="_blank" rel="noreferrer">
                  {slide.cta_label || "Learn more"}
                </a>
              )}
            </Button>
          </div>
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-md hover:bg-white/20"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur-md hover:bg-white/20"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors sm:h-2.5 sm:w-2.5",
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
