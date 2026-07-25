import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Restaurant Management System",
  description: "Sign in to your Restaurant Management System account.",
};

export default function SignInPage() {
  return (
    <main className="sign-in-page">
      <div className="sign-in-brand">
        <div className="sign-in-logo" aria-hidden="true">🍽️</div>
        <h1 className="sign-in-title">Restaurant OS</h1>
        <p className="sign-in-subtitle">Smart Restaurant Management System</p>
      </div>

      <div className="sign-in-card">
        <SignIn
          appearance={{
            elements: {
              rootBox: "clerk-root",
              card: "clerk-card",
              headerTitle: "clerk-header-title",
              headerSubtitle: "clerk-header-subtitle",
              socialButtonsBlockButton: "clerk-social-btn",
              formButtonPrimary: "clerk-primary-btn",
              footerActionLink: "clerk-footer-link",
            },
          }}
        />
      </div>
    </main>
  );
}
