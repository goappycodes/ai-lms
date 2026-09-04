/**
 * The six accounts behind the demo login panel (D-16).
 *
 * Lives here rather than in the route file because Next only permits a fixed
 * set of exports from a route module, and both the seeder and the sign-in
 * endpoint need this list.
 */
export const DEMO_ACCOUNTS = [
  "demo.superadmin",
  "demo.school",
  "demo.teacher",
  "demo.student1",
  "demo.student2",
  "demo.student3",
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];

/** Demo sign-in is off unless explicitly enabled. Never set in production. */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN === "1";
}
