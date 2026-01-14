import { SiteHeader } from "@/components/site-header";

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold tracking-tight mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information We Collect</h2>
              <p className="mb-4">
                Dilag collects minimal information necessary to provide our AI-powered design service. This includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Account information (email, name) when you sign up</li>
                <li>Design prompts and generated content you create</li>
                <li>Usage analytics to improve our service</li>
                <li>Device information for compatibility and licensing</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Your Information</h2>
              <p className="mb-4">
                We use your information to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and maintain the Dilag service</li>
                <li>Generate designs based on your prompts</li>
                <li>Process payments and manage subscriptions</li>
                <li>Improve our AI models and user experience</li>
                <li>Communicate with you about service updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Storage and Security</h2>
              <p>
                Your data is stored securely using industry-standard encryption. We retain your design projects and account information for as long as you maintain an active subscription. You may request deletion of your account and associated data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Services</h2>
              <p className="mb-4">
                Dilag integrates with the following third-party services:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Polar.sh:</strong> For payment processing and subscription management</li>
                <li><strong>OpenAI:</strong> For AI design generation capabilities</li>
                <li><strong>GitHub:</strong> For code hosting and version control</li>
              </ul>
              <p>
                These services have their own privacy policies and we encourage you to review them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p>
                You have the right to access, modify, or delete your personal data. If you have questions about your privacy or wish to exercise these rights, please contact us at contact@dilag.app.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to This Policy</h2>
              <p>
                We may update this privacy policy from time to time. We will notify users of any significant changes via email or through our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at:
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