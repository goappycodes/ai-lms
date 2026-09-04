import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

// Send each role to its own home. Redirecting everyone to /learning meant a
// super admin bounced /learning -> /admin on every visit to the root.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
}
