"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/strings";

/**
 * The one moment a new account's password is visible.
 *
 * Only the hash is stored, so this really is the only chance to read it —
 * which is why it is a panel with an explicit "Done" rather than a toast that
 * slides away while someone is still looking for a pen.
 */
export default function Credentials({
  username,
  password,
  onDone,
}: {
  username: string;
  password: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${username} / ${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard is blocked on insecure origins and in some school
      // browsers. Both values are on screen anyway, so this is not an error
      // worth showing.
    }
  }

  return (
    <div className="credentials" role="status" aria-live="polite">
      <strong>{t("provision.created")}</strong>
      <p className="credentials-warn">{t("provision.once")}</p>
      <dl className="credentials-pair">
        <dt>{t("provision.username")}</dt>
        <dd>
          <code>{username}</code>
        </dd>
        <dt>{t("provision.password")}</dt>
        <dd>
          <code>{password}</code>
        </dd>
      </dl>
      <p className="muted tiny">{t("provision.mustChange")}</p>
      <div className="credentials-actions">
        <button type="button" className="btn btn-small btn-ghost" onClick={copy}>
          {copied ? t("provision.copied") : t("provision.copy")}
        </button>
        <button type="button" className="btn btn-small btn-primary" onClick={onDone}>
          {t("provision.done")}
        </button>
      </div>
    </div>
  );
}
