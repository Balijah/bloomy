export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-green">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground italic">
        TEMPLATE — This document must be reviewed and customized by a qualified
        legal professional before going live. Last updated: {new Date().toLocaleDateString()}.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        When you create an account we collect your name, email address, and
        authentication credentials (managed by Clerk). When you use the service we
        store your saved locations (latitude/longitude, city, state), farm profiles,
        field notes, yield records, input costs, and alert preferences.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide personalized weather forecasts and agricultural insights</li>
        <li>Send weekly digest emails and weather alerts you've opted into</li>
        <li>Process payments through Stripe (we never see your full card number)</li>
        <li>Improve the service through aggregated, anonymized analytics</li>
      </ul>

      <h2>3. Data Sharing</h2>
      <p>
        We do not sell your personal information. We share data only with service
        providers necessary to operate Bloomy:
      </p>
      <ul>
        <li><strong>Clerk</strong> — authentication</li>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>SendGrid</strong> — transactional email</li>
        <li><strong>Open-Meteo</strong> — weather data (receives only coordinates, no personal info)</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We retain your data as long as your account is active. You can delete your
        account at any time from Settings, which permanently removes all your data
        and cancels any active subscription.
      </p>

      <h2>5. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data
        by contacting us or using the in-app account deletion feature.
      </p>

      <h2>6. Security</h2>
      <p>
        We use encryption in transit (TLS), authentication via Clerk, and follow
        industry-standard security practices. Database access is restricted to
        authorized services only.
      </p>

      <h2>7. Contact</h2>
      <p>
        For privacy questions, contact us at{" "}
        <a href="mailto:privacy@bloomy.app">privacy@bloomy.app</a>.
      </p>
    </div>
  );
}
