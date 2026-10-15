export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-green">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground italic">
        TEMPLATE — This document must be reviewed and customized by a qualified
        legal professional before going live. Last updated: {new Date().toLocaleDateString()}.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using Bloomy ("the Service"), you agree to be bound by
        these Terms of Service. If you do not agree, do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        Bloomy provides weather forecasts, agricultural intelligence, and farm
        management tools. Weather data is sourced from third-party providers and
        is provided "as-is" without guarantee of accuracy.
      </p>

      <h2>3. Account Registration</h2>
      <p>
        You must provide accurate information when creating an account. You are
        responsible for maintaining the confidentiality of your credentials and
        for all activity under your account.
      </p>

      <h2>4. Subscription and Billing</h2>
      <ul>
        <li>Free tier: limited features as described on the pricing page</li>
        <li>Paid tiers (Grower, Grower Pro): billed monthly via Stripe</li>
        <li>You may cancel at any time; access continues through the current billing period</li>
        <li>Refunds are handled on a case-by-case basis</li>
      </ul>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to access other users' data</li>
        <li>Reverse-engineer or scrape the Service or its APIs</li>
        <li>Interfere with the Service's operation</li>
      </ul>

      <h2>6. Limitation of Liability</h2>
      <p>
        Bloomy is not liable for crop losses, financial damages, or any other
        harm arising from reliance on weather forecasts or agricultural
        recommendations provided by the Service. Weather data is informational
        only and should not be the sole basis for farming decisions.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate your account for violation of these Terms.
        You may delete your account at any time from Settings.
      </p>

      <h2>8. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service
        after changes constitutes acceptance of the new Terms.
      </p>

      <h2>9. Contact</h2>
      <p>
        For questions about these Terms, contact us at{" "}
        <a href="mailto:legal@bloomy.app">legal@bloomy.app</a>.
      </p>
    </div>
  );
}
