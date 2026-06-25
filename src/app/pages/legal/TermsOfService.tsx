import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to NexusHQ
        </Link>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: June 25, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using NexusHQ ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including tenants, team members, and administrators.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
            <p>NexusHQ is a multi-tenant SaaS platform providing CRM, email marketing, cold email outreach, proposal management, finance/invoicing, and AI-powered sales tools. The Service is provided on a subscription basis with various plan tiers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Account Registration</h2>
            <p>You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. You must notify us immediately of any unauthorized use.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Subscription and Billing</h2>
            <p>Paid plans are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We may change pricing with 30 days notice. Failed payments may result in service suspension after a 7-day grace period.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Acceptable Use</h2>
            <p>You agree not to: (a) use the Service for spam or unsolicited bulk email in violation of CAN-SPAM, GDPR, or similar laws; (b) transmit malicious code; (c) attempt unauthorized access; (d) resell the Service without authorization; (e) use the Service to store or transmit illegal content.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Ownership</h2>
            <p>You retain all rights to your data. We do not claim ownership of content you upload. We may use aggregated, anonymized data for service improvement. Upon account termination, you may export your data within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Service Level</h2>
            <p>We target 99.9% uptime for the Service. Scheduled maintenance windows will be communicated in advance. We are not liable for downtime caused by factors outside our control, including internet infrastructure failures, force majeure events, or third-party service outages.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, NexusHQ shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Termination</h2>
            <p>Either party may terminate this agreement at any time. Upon termination, your access to the Service will cease. We will retain your data for 30 days after termination, after which it may be permanently deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to Terms</h2>
            <p>We reserve the right to modify these terms. Material changes will be communicated via email or in-app notification at least 30 days before taking effect. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:legal@nexushq.io" className="text-primary hover:underline">legal@nexushq.io</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
