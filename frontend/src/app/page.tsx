import { Suspense } from "react";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

/** "/" sends people to their company dashboard, or to login. */
async function Redirector() {
  const user = await getSessionUser();
  return redirect(user ? homeFor(user) : "/login");
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Redirector />
    </Suspense>
  );
}
