import { requirePage } from "@/lib/auth/guard";

/**
 * Auth resolves here, above the loading shell — see app/learning/layout.tsx
 * for why that matters. In short: `loading.tsx` streams a 200 before the page
 * runs, so a redirect from inside the page cannot be an HTTP redirect and a
 * revoked session would sit on the skeleton for good.
 */
export default async function SegmentLayout({ children }: { children: React.ReactNode }) {
  await requirePage("super_admin");
  return <>{children}</>;
}
