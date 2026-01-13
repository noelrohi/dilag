import { Button } from "@dilag/ui";
import { Badge } from "@dilag/ui";
import { SiteHeader } from "@/components/site-header";
import { DOWNLOAD_URL } from "@/lib/constants";
import { Check, Sparkle, Lightning } from "@phosphor-icons/react/dist/ssr";

export default function PricingPage() {
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
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Simple pricing</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            One-time purchase. Lifetime access. No subscriptions.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free Tier */}
          <div className="flex flex-col p-8 rounded-2xl border border-border bg-card/50">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Free Trial</h2>
              <p className="text-sm text-muted-foreground">
                Try Dilag with limited features
              </p>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-bold">$0</span>
              <span className="text-muted-foreground ml-2">forever</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Try before you buy",
                "Full design generation",
                "Community support",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <Check weight="bold" className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button variant="outline" className="w-full" asChild>
              <a href={DOWNLOAD_URL}>
                Download Free
              </a>
            </Button>
          </div>

          {/* Pro Tier */}
          <div className="relative flex flex-col p-8 rounded-2xl border-2 border-primary bg-primary/5">
            <Badge className="absolute -top-3 left-6 gap-1">
              <Sparkle weight="fill" className="w-3 h-3" />
              Most Popular
            </Badge>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Pro License</h2>
              <p className="text-sm text-muted-foreground">
                Full access to all features
              </p>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-bold">$29</span>
              <span className="text-muted-foreground ml-2">one-time</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Unlimited design generations",
                "All export formats (HTML, CSS, React)",
                "Priority support",
                "All future updates",
                "Commercial use license",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <Check weight="bold" className="w-4 h-4 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full gap-2">
              <Lightning weight="fill" className="w-4 h-4" />
              Get Pro License
            </Button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Secure payment via Polar. 14-day money-back guarantee.
        </p>
      </main>
    </div>
  );
}
