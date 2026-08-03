import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="brand">
            <span className="brand-mark">
              <span className="mark-glyph">व</span>
            </span>
            <span className="brand-name">AI Veda</span>
          </div>
          <p className="footer-tag">
            AI literacy for every student in Kerala — from curious to capable.
          </p>
        </div>

        <nav className="footer-cols">
          <div className="footer-col">
            <h4>Program</h4>
            <Link href="/learning">Tracks</Link>
            <Link href="/certificate/explorer">Certificates</Link>
            <Link href="/teacher">For teachers</Link>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <a href="#">Help centre</a>
            <a href="#">Teacher orientation</a>
            <a href="#">Contact</a>
          </div>
          <div className="footer-col">
            <h4>About</h4>
            <a href="#">Privacy</a>
            <a href="#">Data &amp; safety</a>
            <a href="#">Accessibility</a>
          </div>
        </nav>
      </div>

      <div className="footer-bar">
        <span className="powered">
          Powered by{" "}
          <span className="nexis">
            N<span className="e">E</span>XIS
          </span>
        </span>
        <span className="dot">•</span>
        <span>In partnership with the Government of Kerala</span>
        <span className="dot">•</span>
        <span>© 2026 NEXIS School of Business</span>
      </div>
    </footer>
  );
}
