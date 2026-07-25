import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unauthorized — Restaurant Management System",
  description: "You do not have permission to access this page.",
};

export default function UnauthorizedPage() {
  return (
    <main className="unauthorized-page">
      <div className="unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">🚫</div>
        <h1 className="unauthorized-title">Access Denied</h1>
        <p className="unauthorized-message">
          You don&apos;t have the required permissions to view this page.
          <br />
          Please contact your administrator if you believe this is a mistake.
        </p>
        <div className="unauthorized-actions">
          <Link href="/" className="unauthorized-btn-primary" id="go-home-btn">
            Go to Dashboard
          </Link>
          <Link
            href="/sign-in"
            className="unauthorized-btn-secondary"
            id="sign-in-btn"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    </main>
  );
}
