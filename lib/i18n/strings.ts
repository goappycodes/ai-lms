/**
 * The string catalogue. Every user-facing string goes through here from the
 * moment it is typed — retrofitting translation into hardcoded copy is the
 * single most expensive thing to leave until later, and half this product
 * ships in Malayalam.
 *
 * Malayalam is deliberately empty for now. Inventing translations for a
 * government education product would be worse than showing English: the
 * fallback below is the same rule the content tables use, so a missing string
 * renders in English rather than breaking. P3-01 generalises this and P3-03
 * fills the Malayalam in from the content team.
 */
export type Locale = "en" | "ml";
export const LOCALES: Locale[] = ["en", "ml"];
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  "login.title": "Sign in",
  "login.subtitle": "AI literacy for every student in Kerala",
  "login.username": "Username",
  "login.username.placeholder": "e.g. kl0142-6b-023",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.submitting": "Signing in…",
  "login.forgot.heading": "Forgotten your password?",
  "login.forgot.student": "Ask your teacher to reset it for you.",
  "login.forgot.staff": "Teachers ask their school; schools ask NEXIS.",
  "login.error.empty": "Enter your username and password.",
  "login.error.generic": "Something went wrong. Please try again.",
  "login.demo.heading": "Demo accounts",
  "login.demo.note": "One-click sign-in for testing. Not available in production.",
  "login.demo.superadmin": "Super Admin",
  "login.demo.school": "School",
  "login.demo.teacher": "Teacher",
  "login.demo.student1": "Student 1 · Explorer",
  "login.demo.student2": "Student 2 · Builder",
  "login.demo.student3": "Student 3 · Achiever",

  "nav.learning": "My Learning",
  "nav.teacher": "Teacher",
  "nav.admin": "Admin",
  "nav.account": "Account",
  "nav.signout": "Sign out",
  "nav.signingout": "Signing out…",

  "role.super_admin": "Super admin",
  "role.school": "School",
  "role.teacher": "Teacher",
  "role.student": "Student",
} as const;

export type StringKey = keyof typeof en;

const catalogue: Record<Locale, Partial<Record<StringKey, string>>> = {
  en,
  ml: {},
};

/** Looks up a string, falling back to English when a translation is missing. */
export function t(key: StringKey, locale: Locale = DEFAULT_LOCALE): string {
  return catalogue[locale]?.[key] ?? catalogue.en[key] ?? key;
}
