import Link from "next/link";
import { Button } from "@dilag/ui/button";
import Features from "@/components/features-1";
import IntegrationsSection from "@/components/integrations-8";
import HeroSection from "@/components/hero-section";
import FooterSection from "@/components/footer";
import { DOWNLOAD_URL } from "@/lib/constants";
import { Download, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <HeroSection />

      {/* Features */}
      <Features />

      {/* Integrations */}
      <IntegrationsSection />

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="relative p-12 sm:p-16 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-card to-card" />
            <div className="absolute inset-0 border border-border rounded-3xl" />
            
            <div className="relative text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Start designing with AI
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
                Download Dilag and turn your ideas into beautiful interfaces.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild className="h-12 px-8 text-base gap-3 rounded-full">
                  <a href={DOWNLOAD_URL}>
                    <Download className="w-5 h-5" />
                    Download Free
                  </a>
                </Button>
                <Button variant="outline" size="lg" className="h-12 px-8 text-base gap-3 rounded-full" asChild>
                  <Link href="/pricing">
                    View Pricing
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
