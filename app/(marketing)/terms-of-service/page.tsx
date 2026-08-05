import type { Metadata } from "next";
import {
  LegalPage,
  LegalSection,
  LegalList,
  LegalPlaceholder,
} from "@/components/marketing-general/legal";

export const metadata: Metadata = {
  title: "Terms of Service | DBLuna",
};

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="August 5, 2026">
      <p>
        These Terms of Service ("Terms") govern your use of DBLuna, operated
        by <LegalPlaceholder>[Company Legal Name]</LegalPlaceholder>. By
        creating an account or using DBLuna, you agree to these Terms.
      </p>

      <LegalSection title="1. The service">
        <p>
          DBLuna is a visual database schema design and documentation tool:
          an infinite canvas for designing tables and relationships, a DBML
          code editor kept in two-way sync with the canvas, automatically
          generated documentation, schema import from live databases, and
          read-only share links.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <p>
          You need an account to create, edit, export, or share diagrams.
          You're responsible for keeping your account credentials secure and
          for all activity under your account. You must be at least 16 years
          old to create an account.
        </p>
      </LegalSection>

      <LegalSection title="3. Plans and billing">
        <LegalList
          items={[
            <>
              <strong>Free</strong> accounts are view-only: you can browse
              diagrams shared with you, but creating, editing, exporting, and
              sharing your own diagrams requires a paid plan.
            </>,
            <>
              <strong>Pro</strong> is billed monthly or yearly through Clerk
              Billing. Prices are shown on our{" "}
              <a href="/pricing" className="text-brand underline">
                Pricing page
              </a>
              .
            </>,
            <>
              <strong>Enterprise</strong> is billed under a custom agreement,
              negotiated separately after you contact our sales team.
            </>,
          ]}
        />
        <p>
          Subscriptions renew automatically until cancelled. Refunds are
          handled on a case-by-case basis:{" "}
          <LegalPlaceholder>[describe your refund policy]</LegalPlaceholder>.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You own the diagrams, schemas, and content you create in DBLuna. By
          default, that content stays local to your browser. If you enable
          cloud sync, you grant us a limited license to store and transmit
          that content solely to provide the sync feature to you. We don't
          use your diagram content to train any model or share it with third
          parties, except as needed to run the service (see our{" "}
          <a href="/privacy-policy" className="text-brand underline">
            Privacy Policy
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="5. Database import">
        <p>
          When you import a schema from a live database connection, you
          confirm you're authorized to access that database. We use the
          credentials you provide only to open a temporary connection and
          read schema metadata; we don't store them or access your data
          beyond what's needed to build the diagram.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            "Use DBLuna to access databases or systems you're not authorized to access",
            "Attempt to disrupt, overload, or reverse-engineer the service",
            "Use the service to store or transmit unlawful content",
            "Circumvent plan limits or the Free-plan view-only restriction through automated means",
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Intellectual property">
        <p>
          DBLuna's software, design, and branding are owned by{" "}
          <LegalPlaceholder>[Company Legal Name]</LegalPlaceholder>. These
          Terms don't grant you any rights to our trademarks or source code
          beyond what's needed to use the service as intended.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers">
        <p>
          DBLuna is provided "as is," without warranties of any kind. We
          don't guarantee the service will be uninterrupted, error-free, or
          fit for a particular purpose. Nothing in this section limits any
          statutory rights you have as a consumer that can't be waived under
          applicable law.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the extent permitted by law, DBLuna and its operators aren't
          liable for indirect, incidental, or consequential damages arising
          from your use of the service. This doesn't limit liability for
          things that can't legally be limited, such as death, personal
          injury, or fraud.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You can stop using DBLuna and delete your account at any time. We
          may suspend or terminate accounts that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by the laws of{" "}
          <LegalPlaceholder>[Governing Law / Country]</LegalPlaceholder>,
          without regard to conflict-of-law principles. If you're a consumer
          based in the EU or UK, mandatory consumer-protection laws of your
          country of residence may still apply and take precedence over this
          clause.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes to these Terms">
        <p>
          We may update these Terms from time to time. We'll update the
          "Last updated" date above and, for material changes, do our best to
          give you reasonable notice.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          Questions about these Terms? Reach us at{" "}
          <LegalPlaceholder>[legal@dbluna.com]</LegalPlaceholder> or see our{" "}
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
