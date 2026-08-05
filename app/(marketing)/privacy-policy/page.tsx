import type { Metadata } from "next";
import {
  LegalPage,
  LegalSection,
  LegalList,
  LegalPlaceholder,
} from "@/components/marketing-general/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | DBLuna",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="August 5, 2026">
      <p>
        This Privacy Policy explains what personal data DBLuna ("we," "us")
        collects, why we collect it, and the rights you have over it. It
        applies to dbluna.com and the DBLuna application.
      </p>

      <LegalSection title="1. Who we are">
        <p>
          DBLuna is operated by <LegalPlaceholder>[Company Legal Name]</LegalPlaceholder>,
          registered at <LegalPlaceholder>[Registered Business Address]</LegalPlaceholder>.
          For any question about this policy or your data, contact us at{" "}
          <LegalPlaceholder>[privacy@dbluna.com]</LegalPlaceholder>.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <p>What we collect depends on how you use DBLuna:</p>
        <LegalList
          items={[
            <>
              <strong>Account data.</strong> If you sign up, our
              authentication provider (Clerk) collects your email, name, and
              profile image.
            </>,
            <>
              <strong>Billing data.</strong> If you subscribe to a paid plan,
              Clerk Billing processes your subscription status and plan.
              DBLuna does not receive or store your card details.
            </>,
            <>
              <strong>Diagram content.</strong> By default, your diagrams are
              stored locally in your browser and never leave your device. If
              you opt in to cloud sync, that diagram's content is also stored
              on our servers (via Convex) so you can access it from another
              device.
            </>,
            <>
              <strong>Database import credentials.</strong> If you import a
              schema from a live PostgreSQL or SQL Server connection, the
              host, port, username, and password you provide are used only to
              open a temporary connection, read the schema, and are then
              discarded. We do not log or store these credentials.
            </>,
            <>
              <strong>Technical data.</strong> Standard web server logs (IP
              address, browser type, request timestamps) collected by our
              hosting provider for security and reliability purposes.
            </>,
          ]}
        />
        <p>
          We do not currently use analytics or advertising trackers of any
          kind.
        </p>
      </LegalSection>

      <LegalSection title="3. Why we process your data">
        <p>Under the GDPR, we rely on the following legal bases:</p>
        <LegalList
          items={[
            "Performance of a contract, to create your account and provide the service you signed up for.",
            "Legitimate interest, to keep the service secure, diagnose issues, and operate our infrastructure.",
            "Consent, where you opt in to cloud sync for a diagram, or to any optional communications.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Who we share data with">
        <p>
          We share data only with the service providers ("sub-processors")
          that run DBLuna's infrastructure, and only to the extent needed to
          provide the service:
        </p>
        <LegalList
          items={[
            <>
              <strong>Clerk</strong>, for authentication and billing.
            </>,
            <>
              <strong>Convex</strong>, for cloud-synced diagram storage and
              our backend database.
            </>,
            <LegalPlaceholder key="hosting">
              [Hosting provider, e.g. Vercel]
            </LegalPlaceholder>,
          ]}
        />
        <p>
          We do not sell your personal data. Some of these providers may
          process data outside the European Economic Area; where that
          happens, we rely on Standard Contractual Clauses or an equivalent
          safeguard recognized under GDPR.
        </p>
      </LegalSection>

      <LegalSection title="5. How long we keep it">
        <p>
          We retain account and billing data for as long as your account is
          active, and diagram content stored on our servers for as long as
          you keep cloud sync enabled for that diagram. You can delete a
          synced diagram, or your account entirely, at any time.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights">
        <p>
          If you're in the European Economic Area, the UK, or another
          jurisdiction with similar protections, you have the right to:
        </p>
        <LegalList
          items={[
            "Access the personal data we hold about you",
            "Correct inaccurate data",
            "Request deletion of your data",
            "Restrict or object to certain processing",
            "Receive your data in a portable format",
            "Withdraw consent at any time, where processing is based on consent",
            "Lodge a complaint with your local data protection authority",
          ]}
        />
        <p>
          To exercise any of these rights, contact us at{" "}
          <LegalPlaceholder>[privacy@dbluna.com]</LegalPlaceholder>.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>
          See our{" "}
          <a href="/cookie-policy" className="text-brand underline">
            Cookie Policy
          </a>{" "}
          for details on the cookies DBLuna uses.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          DBLuna is not directed at children under 16, and we do not
          knowingly collect personal data from them.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>
          We may update this policy from time to time. We'll update the "Last
          updated" date above when we do, and post material changes on this
          page.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Questions about this policy? Reach us at{" "}
          <LegalPlaceholder>[privacy@dbluna.com]</LegalPlaceholder> or see our{" "}
          <a href="/contact" className="text-brand underline">
            Contact page
          </a>
          .
        </p>
      </LegalSection>

      <p className="text-xs text-gray-400 dark:text-neutral-600">
        This page is a starting point grounded in how DBLuna's product
        actually works, not legal advice. Have it reviewed by a qualified
        lawyer, and fill in the{" "}
        <LegalPlaceholder>highlighted placeholders</LegalPlaceholder> with
        your real business details, before relying on it.
      </p>
    </LegalPage>
  );
}
