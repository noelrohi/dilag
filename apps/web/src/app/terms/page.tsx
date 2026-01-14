import { SiteHeader } from "@/components/site-header";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold tracking-tight mb-8">Terms of Service</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptance of Terms</h2>
              <p>
                By using Dilag ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree to these Terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Description of Service</h2>
              <p>
                Dilag is an AI-powered design studio that helps users create mobile and web application designs 
                through natural language prompts. The Service is provided on a subscription basis with various 
                pricing tiers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">User Accounts</h2>
              <p className="mb-4">
                To use the Service, you must:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Be at least 13 years of age</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Be responsible for all activities under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Subscription and Payment</h2>
              <p className="mb-4">
                Dilag offers subscription plans with the following terms:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Subscriptions are billed monthly or as a one-time lifetime purchase</li>
                <li>Free trials are available for new users</li>
                <li>Payments are processed through Polar.sh</li>
                <li>You may cancel your subscription at any time</li>
                <li>No refunds are provided for partial months of service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p className="mb-4">
                Regarding intellectual property:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You retain ownership of designs you create using Dilag</li>
                <li>Dilag retains ownership of the Service, AI models, and underlying technology</li>
                <li>You may use generated designs for commercial purposes</li>
                <li>You may not reverse engineer or extract our AI models</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptable Use</h2>
              <p className="mb-4">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create designs that are illegal, harmful, or offensive</li>
                <li>Generate content that violates intellectual property rights</li>
                <li>Attempt to circumvent usage limits or licensing restrictions</li>
                <li>Use the Service for competitive analysis or reverse engineering</li>
                <li>Spam or harass other users</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Service Availability</h2>
              <p>
                We strive to maintain high availability of the Service but do not guarantee uninterrupted access. 
                We may temporarily suspend the Service for maintenance, updates, or other technical reasons. 
                We are not liable for any downtime or service interruptions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, Dilag shall not be liable for any indirect, incidental, 
                special, or consequential damages resulting from your use of the Service, including but not limited 
                to loss of profits, data, or business opportunities.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Termination</h2>
              <p>
                We may terminate or suspend your account at our sole discretion, without prior notice or liability, 
                for any reason, including if you breach these Terms. Upon termination, your right to use the Service 
                will cease immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction 
                in which Dilag operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of any significant 
                changes via email or through the Service. Your continued use of the Service after such changes 
                constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Information</h2>
              <p>
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <p className="mt-2">
                Email: contact@dilag.app<br />
                Website: https://dilag.app
              </p>
            </section>
          </div>

          <div className="mt-12 text-sm text-muted-foreground">
            <p>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </main>
    </div>
  );
}