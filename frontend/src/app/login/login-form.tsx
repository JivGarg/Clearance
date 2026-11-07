"use client";

import { useActionState, useState } from "react";
import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { DEMO_PASSWORD, DEMO_USERS, orgName } from "@/lib/demo-users";
import { ROLE_LABEL } from "@/lib/domain";

const INITIAL: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.error ? (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[14px] font-medium text-danger-ink">
            {state.error}
          </p>
        ) : null}
        <TextField label="Email" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="demo-accounts" className="font-semibold">
            Demo accounts
          </h3>
          <Tag>Fictional demo data</Tag>
        </div>
        <p className="mt-1 text-[14px] text-text-muted">
          Pick one to fill the form. Password for all: <span className="font-medium text-text">{DEMO_PASSWORD}</span>
        </p>
        <ul className="mt-4 grid gap-2">
          {DEMO_USERS.map((u) => {
            const m = u.memberships[0];
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="flex min-h-11 w-full flex-col items-start rounded-control border border-border bg-surface/80 px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-purple-soft"
                >
                  <span className="text-[14px] font-semibold">
                    {ROLE_LABEL[m.role]} · {orgName(m.orgId)}
                    {u.memberships.length > 1 ? " +1 company" : ""}
                  </span>
                  <span className="break-all text-[13px] text-text-muted">{u.email}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
