import { SiteHeader } from "@/components/site-header";
import FAQsFour from "@/components/faqs-4";

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader />

      <main className="pt-20">
        <FAQsFour />
      </main>
    </div>
  );
}
