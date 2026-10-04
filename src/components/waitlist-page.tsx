import { FormEvent, useState } from "react";
import { Link } from "@tanstack/react-router";

import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitlistPage({ title, description }: { title: string; description: string }) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="relative grid min-h-dvh place-items-center bg-background px-6 py-24">
      <AppMenu />
      <div className="mx-auto w-full max-w-xl text-center">
        <h1 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
        {submitted ? (
          <p role="status" className="mt-8 text-base font-medium text-primary">
            You're on the list. We'll be in touch.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-8 grid w-full max-w-md gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-12 bg-card px-4 shadow-none"
            />
            <Button type="submit" className="h-12 px-6 font-bold uppercase">
              Notify Me
            </Button>
          </form>
        )}
        <Button asChild variant="link" className="mt-7 h-auto px-2 text-base">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </main>
  );
}