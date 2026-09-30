import { LegalPage } from "@/components/legal/legal-page";

export const metadata = {
  title: "Terms of Service — ProfJohns",
  description: "The terms and conditions for using ProfJohns.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="September 30, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of
        ProfJohns, a research workspace application operated by ProfJohns
        (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By creating
        an account or using the service, you agree to these Terms.
      </p>

      <h2>1. Using ProfJohns</h2>
      <p>
        ProfJohns is an AI-powered research canvas that helps you find academic
        sources, organize them on a visual board, synthesize findings, and draft
        written work. You must be at least 13 years old to use the service. If
        you are under 18, you need a parent or guardian&apos;s permission.
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your account credentials secure and for
        all activity under your account. Notify us immediately if you suspect
        unauthorized access. We may suspend or terminate accounts that violate
        these Terms.
      </p>

      <h2>3. Plans and billing</h2>
      <p>
        ProfJohns offers a Free plan and a Pro plan ($19/month). The Free plan
        includes one research project and basic source search. The Pro plan
        includes unlimited projects, the full research agent, standing watch
        tasks, and semantic search.
      </p>
      <p>
        Pro subscriptions are billed monthly through Stripe and auto-renew until
        you cancel. You can cancel at any time through the billing portal —
        access continues until the end of your current billing period. We do not
        offer refunds for partial billing periods.
      </p>
      <p>
        We may change pricing with at least 30 days&apos; notice. Existing
        subscribers keep their current rate until the next renewal.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful purpose</li>
        <li>Attempt to access another user&apos;s data without authorization</li>
        <li>Reverse-engineer, decompile, or disassemble the application</li>
        <li>Scrape, crawl, or systematically extract data from the service</li>
        <li>
          Use AI-generated content from ProfJohns to plagiarize or violate
          academic integrity policies
        </li>
        <li>
          Abuse, overload, or interfere with the service&apos;s infrastructure
        </li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        You retain ownership of research directions, notes, drafts, and other
        content you create in ProfJohns (&ldquo;Your Content&rdquo;). You grant
        us a limited license to process Your Content through third-party AI
        providers (OpenRouter, TypeSafe) to provide the service&apos;s features.
        We do not claim ownership of Your Content.
      </p>
      <p>
        You are responsible for ensuring Your Content does not violate
        copyright, privacy, or other rights of third parties.
      </p>

      <h2>6. AI-generated output</h2>
      <p>
        ProfJohns uses third-party language models to generate summaries,
        synthesis, and draft text. AI output may contain errors, omissions, or
        inaccurate citations. You are responsible for verifying all AI-generated
        content before relying on it for academic or professional work. We do
        not guarantee the accuracy, completeness, or reliability of AI output.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The ProfJohns application, including its design, code, branding, and
        features, is our intellectual property. These Terms do not grant you any
        rights to our trademarks, logos, or proprietary technology.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        ProfJohns integrates with Stripe (payments), Supabase (database and
        authentication), OpenRouter (AI models), and academic APIs (OpenAlex,
        arXiv, Semantic Scholar). Their respective terms and privacy policies
        apply to your use of those services through ProfJohns.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        ProfJohns is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
        without warranties of any kind, whether express or implied. We do not
        warrant that the service will be uninterrupted, error-free, or secure.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any
        indirect, incidental, special, or consequential damages arising from
        your use of ProfJohns, including loss of data, research, or profits.
        Our total liability for any claim is limited to the amount you paid us
        in the 12 months preceding the claim.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate
        your access for violation of these Terms or for any other reason with
        notice. Upon termination, your right to use the service ends. Your data
        is deleted in accordance with our Privacy Policy.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify users of
        material changes by email or in-app notice at least 30 days before they
        take effect. Continued use after the effective date constitutes
        acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href="mailto:support@profjohns.com">support@profjohns.com</a>.
      </p>
    </LegalPage>
  );
}