import { requirePage } from "@/lib/auth/guard";

/**
 * Auth resolves here, above the loading shell.
 *
 * `loading.tsx` puts a Suspense boundary around the page, so the moment it
 * exists Next streams a 200 with the skeleton before the page component has
 * run. A `redirect()` from inside the page then cannot be an HTTP redirect —
 * it goes into the stream, and on a hard navigation the browser sits on the
 * skeleton forever. Someone whose account was disabled, or whose session was
 * revoked, would watch a loading animation instead of being sent to sign in.
 *
 * A layout renders *before* that boundary, so the redirect is a real one
 * again. The cost is that the shell waits for the session lookup — about 50 ms
 * — instead of appearing instantly, which is still far better than the blank
 * page it replaced, and correctness is not negotiable against 50 ms.
 *
 * The page calls requirePage() too. That is not redundant: it needs the user
 * object, and `cache()` means the second call is free.
 */
export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  await requirePage();
  return <>{children}</>;
}
