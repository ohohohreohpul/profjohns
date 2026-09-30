import { LegalPage } from "@/components/legal/legal-page";

export const metadata = {
  title: "Privacy Policy — ProfJohns",
  description: "How ProfJohns collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="September 30, 2026">
      <p>
        This Privacy Policy explains how ProfJohns (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, uses, and protects your information when you
        use our research workspace application. We are committed to transparency
        and minimal data collection.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Account information</h3>
      <p>
        When you create an account, we collect your email address and display
        name. If you sign in with Google, we receive your Google profile name
        and avatar. We do not request access to your Google documents, contacts,
        or other Google data.
      </p>

      <h3>Research content</h3>
      <p>
        We store the research directions, canvas layouts, notes, drafts, and
        sources you create. This is your content — we process it to provide the
        service&apos;s features but do not use it to train AI models.
      </p>

      <h3>Usage data</h3>
      <p>
        We log basic usage metrics (pages visited, features used, timestamps)
        to improve the service and diagnose issues. We do not use cross-site
        tracking cookies.
      </p>

      <h3>Payment information</h3>
      <p>
        Subscription payments are processed by Stripe. We never see or store
        your full card number, CVV, or other sensitive payment details. Stripe
        provides us with your customer ID, subscription status, and billing
        email. See{" "}
        <a
          href="https://stripe.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Stripe&apos;s Privacy Policy
        </a>{" "}
        for details.
      </p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the ProfJohns service</li>
        <li>To authenticate you and secure your account</li>
        <li>
          To process AI features, we send your research directions and source
          text to OpenRouter (AI model provider) and TypeSafe (structured
          decision layer). These providers process data on our behalf and do not
          use it to train their models.
        </li>
        <li>To send service notices, billing receipts, and security alerts</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>3. Third-party providers</h2>
      <p>
        ProfJohns relies on the following third-party services. Each has its own
        privacy policy linked below:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and file
          storage. Your data is stored in Supabase&apos;s EU (Frankfurt)
          region.{" "}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Supabase Privacy Policy
          </a>
        </li>
        <li>
          <strong>Stripe</strong> — payment processing.{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe Privacy Policy
          </a>
        </li>
        <li>
          <strong>OpenRouter</strong> — AI model routing. Your research text is
          sent to OpenRouter to generate summaries and synthesis.{" "}
          <a
            href="https://openrouter.ai/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenRouter Privacy Policy
          </a>
        </li>
        <li>
          <strong>TypeSafe</strong> — structured AI decisions for source scoring
          and citation auditing.{" "}
          <a
            href="https://docs.typesafe.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            TypeSafe
          </a>
        </li>
        <li>
          <strong>Academic APIs</strong> — OpenAlex, arXiv, and Semantic Scholar
          for source search. These receive search queries, not your personal
          data.
        </li>
      </ul>

      <h2>4. Data retention</h2>
      <p>
        We retain your data for as long as your account is active. When you
        delete your account, we remove your personal data from our database
        within 30 days. Some residual data may remain in encrypted database
        backups for up to 90 days before permanent deletion.
      </p>
      <p>
        If you cancel your Pro subscription but keep your account, your data is
        preserved so you can resubscribe without losing your research.
      </p>

      <h2>5. Security</h2>
      <p>
        We use industry-standard security measures: encrypted data transit
        (HTTPS/TLS), Row Level Security in our database (each user can only
        access their own data), server-side secret management, and a strict
        Content Security Policy. Payment data never touches our servers.
      </p>
      <p>
        No method of transmission or storage is 100% secure. We cannot guarantee
        absolute security but we are committed to protecting your data.
      </p>

      <h2>6. Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a copy of your personal data</li>
        <li><strong>Delete</strong> — request deletion of your account and data</li>
        <li><strong>Export</strong> — download your research content as JSON</li>
        <li><strong>Correct</strong> — update your profile information</li>
        <li>
          <strong>Object</strong> — request we stop processing your data for
          specific purposes
        </li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:support@profjohns.com">support@profjohns.com</a>. We
        respond within 30 days.
      </p>

      <h2>7. Cookies</h2>
      <p>
        ProfJohns uses essential cookies for authentication and session
        management. We do not use advertising cookies, tracking pixels, or
        third-party analytics. Our Content Security Policy blocks third-party
        scripts from loading on your browser.
      </p>

      <h2>8. Children&apos;s privacy</h2>
      <p>
        ProfJohns is not directed to children under 13. We do not knowingly
        collect data from children under 13. If you believe a child has provided
        us with personal data, contact us and we will delete it.
      </p>

      <h2>9. International data transfers</h2>
      <p>
        Your data is stored in Supabase&apos;s EU (Frankfurt) region. AI
        processing occurs through OpenRouter and TypeSafe, which may process
        data in the United States. By using ProfJohns, you consent to these
        transfers.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify
        users of material changes by email or in-app notice at least 30 days
        before they take effect.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about your privacy or this policy? Email us at{" "}
        <a href="mailto:support@profjohns.com">support@profjohns.com</a>.
      </p>
    </LegalPage>
  );
}