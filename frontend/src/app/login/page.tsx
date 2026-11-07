import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { homeFor } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

async function RedirectIfSignedIn() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user));
  return null;
}

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl content-center gap-10 px-4 py-10 lg:grid-cols-2 lg:items-center lg:px-8">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <div>
        <p className="font-serif text-[28px] italic leading-none">
          Clearance<span className="text-accent">.</span>
        </p>
        <h1 className="mt-6 font-serif text-5xl italic leading-[1.05] sm:text-6xl">Nothing goes live without clearance.</h1>
        <p className="mt-6 max-w-md text-[16px] text-text-muted">
          Drafts are checked against your approved guidelines, facts and embargoes before they go out. Every
          finding cites its source, and every risky call stays with a person.
        </p>
      </div>

      <Card className="sm:p-8">
        <h2 className="mb-6 font-serif text-3xl">Sign in</h2>
        <LoginForm />
      </Card>
    </main>
  );
}
