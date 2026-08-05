import type { Metadata } from "next";
import {
  LegalPage,
  LegalSection,
  LegalList,
  LegalPlaceholder,
} from "@/components/marketing-general/legal";

export const metadata: Metadata = {
  title: "Cookie Policy | DBLuna",
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="August 5, 2026">
      <p>
        This page explains what cookies and similar technologies DBLuna
        actually uses. We've kept this short on purpose: DBLuna uses far
        fewer cookies than most sites.
      </p>

      <LegalSection title="1. Our public pages set no cookies">
        <p>
          dbluna.com's marketing pages (this page included) don't set any
          cookies. There's no analytics, advertising, or tracking script
          running here.
        </p>
      </LegalSection>

      <LegalSection title="2. Signing in sets one, strictly necessary cookie">
        <p>
          Once you sign in, our authentication provider (Clerk) sets a
          session cookie so you stay logged in as you move around the app.
          This cookie is strictly necessary for the service to work and
          doesn't require your consent under EU/UK cookie law, though we're
          disclosing it here for transparency. It's not used for advertising
          or tracking you across other sites.
        </p>
      </LegalSection>

      <LegalSection title="3. Local storage for your diagrams">
        <p>
          Your diagrams are stored in your browser's local storage
          (IndexedDB), not in a cookie. This is what lets DBLuna work
          offline and load your diagrams instantly. It stays on your device
          unless you opt in to cloud sync.
        </p>
      </LegalSection>

      <LegalSection title="4. No analytics or marketing cookies, today">
        <p>
          We don't currently use Google Analytics, advertising pixels, or any
          third-party tracker. If that changes in the future, we'll update
          this page and add a cookie consent banner before any non-essential
          cookie is set.
        </p>
      </LegalSection>

      <LegalSection title="5. Managing cookies">
        <p>
          You can clear or block cookies through your browser settings.
          Since the only cookie we use is the sign-in session cookie,
          blocking it will simply sign you out.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Questions about this policy? Reach us at{" "}
          <LegalPlaceholder>[privacy@dbluna.com]</LegalPlaceholder>.
        </p>
      </LegalSection>

      <p className="text-xs text-gray-400 dark:text-neutral-600">
        This page reflects the codebase as audited on the "Last updated"
        date above, not legal advice. Re-check it whenever you add a new
        script, SDK, or tracker, and fill in the{" "}
        <LegalPlaceholder>highlighted placeholder</LegalPlaceholder> with your
        real contact details.
      </p>
    </LegalPage>
  );
}
