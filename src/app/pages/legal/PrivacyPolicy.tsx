import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to NexusHQ
        </Link>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 25, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p>NexusHQ ("we", "us", "our") respects your privacy and is committed to protecting your personal data. This policy describes how we collect, use, and protect information when you use our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Data We Collect</h2>
            <p><strong>Account Data:</strong> Name, email address, company name, phone number, job title, and billing information.</p>
            <p><strong>Usage Data:</strong> Pages visited, features used, session duration, IP address, browser type, and device information.</p>
            <p><strong>Customer Data:</strong> Contacts, companies, deals, email content, and other business data you store in the platform.</p>
            <p><strong>Communication Data:</strong> Support requests, feedback, and correspondence with our team.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Data</h2>
            <p>We use your data to: (a) provide and maintain the Service; (b) process payments; (c) send transactional emails (password resets, invoices, system alerts); (d) improve the Service through analytics; (e) comply with legal obligations; (f) prevent fraud and abuse.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with: (a) service providers who assist in operating the platform (payment processors, email delivery, cloud hosting); (b) law enforcement when required by law; (c) in connection with a merger, acquisition, or sale of assets, with prior notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active plus 30 days after deletion. Audit logs are retained for 2 years. Anonymized analytics data may be retained indefinitely.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Your Rights (GDPR / CCPA)</h2>
            <p>You have the right to: (a) <strong>Access</strong> your personal data; (b) <strong>Rectify</strong> inaccurate data; (c) <strong>Delete</strong> your data ("right to be forgotten"); (d) <strong>Export</strong> your data in a portable format; (e) <strong>Object</strong> to processing; (f) <strong>Withdraw consent</strong> at any time.</p>
            <p>To exercise these rights, contact <a href="mailto:privacy@nexushq.io" className="text-primary hover:underline">privacy@nexushq.io</a> or use the data export feature in your account settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Security</h2>
            <p>We protect your data with: AES-256-GCM encryption for sensitive credentials, scrypt password hashing, TLS 1.2+ encryption in transit, role-based access control, and regular security audits. Despite our measures, no system is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Cookies</h2>
            <p>We use essential cookies for authentication (session tokens, CSRF protection) and functional cookies (sidebar preferences). We do not use advertising or third-party tracking cookies. You can manage cookies through your browser settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. International Data Transfers</h2>
            <p>Your data may be processed in countries where our service providers operate. We ensure appropriate safeguards (Standard Contractual Clauses or equivalent) are in place for cross-border transfers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to This Policy</h2>
            <p>We may update this policy periodically. Material changes will be communicated via email at least 30 days before taking effect.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact</h2>
            <p>For privacy inquiries, contact our Data Protection Officer at <a href="mailto:privacy@nexushq.io" className="text-primary hover:underline">privacy@nexushq.io</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
