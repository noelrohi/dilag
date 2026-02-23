import Link from "next/link";
import { Button } from "@dilag/ui/button";
import { Badge } from "@dilag/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { DOWNLOAD_URL } from "@/lib/constants";
import { Check, Sparkle, DownloadSimple } from "@phosphor-icons/react/dist/ssr";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        <div className="text-center mb-12">
          <Badge className="gap-1 mb-6">
            <Sparkle weight="fill" className="w-3 h-3" />
            Free Forever
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Simple pricing</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Dilag is fully free. Download and start designing immediately.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="flex flex-col p-8 rounded-2xl border-2 border-primary bg-primary/5">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-1">Dilag</h2>
              <p className="text-sm text-muted-foreground">All features included, no account required</p>
            </div>

            <div className="mb-8">
              <span className="text-5xl font-bold">$0</span>
              <span className="text-muted-foreground ml-2">forever</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Unlimited design generations",
                "Mobile and web outputs",
                "HTML/CSS export",
                "All future updates",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm">
                  <Check weight="bold" className="w-4 h-4 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button className="w-full gap-2" asChild>
              <a href={DOWNLOAD_URL}>
                <DownloadSimple weight="bold" className="w-4 h-4" />
                Download for macOS
              </a>
            </Button>
          </div>
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-muted-foreground">
            Questions? <Link href="/faq" className="text-primary hover:text-primary/80 font-medium">Read the FAQ</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
