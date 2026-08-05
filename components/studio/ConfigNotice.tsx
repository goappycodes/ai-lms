import TopNav from "@/components/TopNav";

const VARS = [
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_PORT",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_DB_NAME",
];

// Shown when the Studio can't reach Supabase (usually: env vars not set on the
// host, e.g. a fresh Vercel deploy where .env.local was never uploaded).
export default function ConfigNotice({ detail }: { detail?: string }) {
  return (
    <>
      <TopNav />
      <main className="container narrow">
        <div className="panel">
          <h1>Database not connected</h1>
          <p className="muted">
            The Content Studio reads and writes to Supabase Postgres, but it couldn&apos;t connect.
            On Vercel this almost always means the database environment variables aren&apos;t set —
            <code>.env.local</code> is never deployed.
          </p>
          <h3>Fix</h3>
          <p className="muted">
            In your Vercel project → <strong>Settings → Environment Variables</strong>, add these
            (values from your <code>.env.local</code>), then <strong>Redeploy</strong>:
          </p>
          <ul className="env-list">
            {VARS.map((v) => (
              <li key={v}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
          <p className="muted tiny">
            Enter the password <strong>raw</strong> on Vercel (no <code>\$</code> escaping — that&apos;s
            only needed in local <code>.env</code> files). Use the IPv4 session-pooler host.
          </p>
          {detail && (
            <p className="form-err banner" style={{ marginTop: 14 }}>
              {detail}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
