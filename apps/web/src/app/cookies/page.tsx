import { SiteHeader } from "@/components/site-header";

export default function CookiesPage() {
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
          <h1 className="text-4xl font-bold tracking-tight mb-8">Cookie Policy</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">What Are Cookies</h2>
              <p>
                Cookies are small text files that are stored on your device when you visit a website. 
                They help us provide you with a better experience by remembering your preferences and 
                enabling certain functionality.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Cookies</h2>
              <p className="mb-4">
                Dilag uses cookies for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for the website to function properly</li>
                <li><strong>Authentication Cookies:</strong> Keep you logged in to your account</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and choices</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how you use our service</li>
                <li><strong>Functional Cookies:</strong> Enable enhanced features and personalization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Types of Cookies We Use</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Essential Cookies</h3>
                  <p>These cookies are necessary for the website to function and cannot be switched off.</p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Performance Cookies</h3>
                  <p>These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.</p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Functional Cookies</h3>
                  <p>These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Cookies</h2>
              <p className="mb-4">
                We use the following third-party services that may set their own cookies:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Polar.sh:</strong> Payment processing and subscription management</li>
                <li><strong>GitHub:</strong> Code hosting and version control</li>
                <li><strong>Analytics Providers:</strong> Website usage analysis and optimization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Managing Your Cookies</h2>
              <p className="mb-4">
                You can control and manage cookies in various ways:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Browser settings to block or delete cookies</li>
                <li>Cookie consent banner on our website</li>
                <li>Opt-out tools provided by third-party services</li>
              </ul>
              <p>
                Please note that blocking essential cookies may affect the functionality of our website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Cookie Duration</h2>
              <p>
                Cookies have different lifespans:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                <li><strong>Persistent Cookies:</strong> Remain on your device for a set period or until you delete them</li>
                <li><strong>Authentication Cookies:</strong> Typically last for your session duration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p>
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Accept or reject non-essential cookies</li>
                <li>View what cookies are stored on your device</li>
                <li>Delete cookies from your browser at any time</li>
                <li>Opt out of tracking and analytics cookies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Updates to This Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices 
                or for legal reasons. We will notify users of any significant changes via our website 
                or email.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p>
                If you have questions about this Cookie Policy, please contact us at:
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