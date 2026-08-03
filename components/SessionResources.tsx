import { Session } from "@/lib/types";

export default function SessionResources({ session }: { session: Session }) {
  return (
    <section className="panel">
      <p className="takeaway">
        <strong>Takeaway:</strong> {session.takeaway}
      </p>
      <p className="muted tools">
        <strong>Tools shown:</strong> {session.tools}
      </p>

      <h3>Downloads</h3>
      <ul className="resource-list">
        <li>
          <a href="#" className="resource">
            <span className="ic">PDF</span> Facilitation guide — {session.title}
          </a>
        </li>
        <li>
          <a href="#" className="resource">
            <span className="ic">PDF</span> Student worksheet
          </a>
        </li>
      </ul>

      <div className="discussion">
        <h3>Discussion prompt</h3>
        <p className="muted">
          The video ends on a prompt slide. The teacher then leads a 10–15 min discussion and a
          5-minute activity using the facilitation guide above.
        </p>
      </div>
    </section>
  );
}
