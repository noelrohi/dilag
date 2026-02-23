import { SiteHeader } from "@/components/site-header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
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
              <p className="mb-4">Dilag collects limited data needed to operate and improve the product:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Design prompts and generated outputs</li>
                <li>Basic device and runtime diagnostics</li>
                <li>Anonymous usage telemetry for product quality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Information</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Deliver and maintain Dilag functionality</li>
                <li>Improve generation quality and reliability</li>
                <li>Troubleshoot and secure the service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Storage and Security</h2>
              <p>
                We apply reasonable technical and organizational safeguards. You can request deletion of personal data by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Services</h2>
              <p className="mb-4">Dilag integrates with third-party providers where required to run the service:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>AI Providers:</strong> Design generation</li>
                <li><strong>GitHub:</strong> Code hosting and issue tracking</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p>
                You may request access, correction, or deletion of your personal data by contacting us at contact@dilag.app.
              </p>
            </section>
          </div>

          <div className="mt-12 text-sm text-muted-foreground">
            <p>Last updated: February 23, 2026</p>
          </div>
        </div>
      </main>
    </div>
  );
}
