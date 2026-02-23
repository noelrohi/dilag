import { SiteHeader } from "@/components/site-header";

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold tracking-tight mb-8">Terms of Service</h1>

          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptance of Terms</h2>
              <p>
                By using Dilag, you agree to these Terms of Service. If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Service Description</h2>
              <p>
                Dilag is an AI-powered design studio for generating user interface concepts and code from natural language prompts.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptable Use</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Do not use Dilag for illegal, harmful, or abusive activity.</li>
                <li>Do not attempt to disrupt or reverse engineer the service.</li>
                <li>Do not submit content that infringes third-party rights.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>You retain ownership of content you create.</li>
                <li>Dilag retains ownership of the software and platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Disclaimer and Liability</h2>
              <p>
                Dilag is provided &quot;as is&quot; without warranties. To the maximum extent permitted by law, Dilag is not liable for indirect or consequential damages.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes</h2>
              <p>We may update these terms from time to time. Continued use constitutes acceptance of updates.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact</h2>
              <p>Email: contact@dilag.app</p>
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
