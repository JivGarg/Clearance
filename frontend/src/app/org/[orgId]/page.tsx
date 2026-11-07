import { redirect } from "next/navigation";
import { orgPath } from "@/lib/roles";

export default async function OrgIndex({ params }: PageProps<"/org/[orgId]">) {
  const { orgId } = await params;
  return redirect(orgPath(orgId));
}
