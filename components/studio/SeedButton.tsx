"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SeedButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function seed() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(
        `Imported ${data.created.length} course(s)${data.skipped.length ? `, ${data.skipped.length} already existed` : ""}.`
      );
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seed-row">
      <button className="btn btn-ghost" onClick={seed} disabled={busy}>
        {busy ? "Importing…" : "Import 3-track curriculum"}
      </button>
      {msg && <span className="muted tiny">{msg}</span>}
    </div>
  );
}
