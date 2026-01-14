import { Button } from "@dilag/ui";
import { Badge } from "@dilag/ui";
import { SiteHeader } from "@/components/site-header";
import { DOWNLOAD_URL } from "@/lib/constants";
import { 
  DownloadSimple, 
  AppleLogo, 
  WindowsLogo,
  CheckCircle,
  Clock,
} from "@phosphor-icons/react/dist/ssr";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-primary/3 rounded-full blur-[100px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader />

      <main className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="text-center mb-4">
          <Badge variant="outline" className="mb-6">
            <DownloadSimple weight="bold" className="w-3 h-3" />
            Download
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Download for macOS and Windows
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Download the Dilag app and start designing with natural language today.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12">
          {/* macOS */}
          <div className="relative flex flex-col items-center p-8 rounded-2xl border border-border bg-card/50 hover:bg-card/80 transition-colors">
            {/* macOS Finder Icon */}
            <div className="w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5AC8FA] via-[#007AFF] to-[#5856D6] rounded-[22px] shadow-xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Simplified Finder face */}
                  <svg
                    viewBox="0 0 100 100"
                    className="w-16 h-16"
                    fill="none"
                  >
                    {/* Face outline */}
                    <ellipse cx="50" cy="55" rx="35" ry="38" fill="white" />
                    {/* Left eye */}
                    <ellipse cx="38" cy="45" rx="8" ry="10" fill="#1a1a1a" />
                    {/* Right eye */}
                    <ellipse cx="62" cy="45" rx="8" ry="10" fill="#1a1a1a" />
                    {/* Nose line */}
                    <line x1="50" y1="50" x2="50" y2="65" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
                    {/* Mouth */}
                    <path d="M35 75 Q50 85 65 75" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" fill="none" />
                  </svg>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-1">macOS</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Compatible with Intel and Apple Silicon
            </p>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <CheckCircle weight="fill" className="w-4 h-4 text-emerald-500" />
              <span>Ready to download</span>
            </div>

            <Button className="w-full gap-2" asChild>
              <a href={DOWNLOAD_URL}>
                <DownloadSimple weight="bold" className="w-4 h-4" />
                Download for macOS
              </a>
            </Button>
          </div>

          {/* Windows */}
          <div className="relative flex flex-col items-center p-8 rounded-2xl border border-border bg-card/30 opacity-75">
            {/* Windows Icon */}
            <div className="w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00A4EF] to-[#0078D4] rounded-[22px] shadow-xl flex items-center justify-center">
                <WindowsLogo weight="fill" className="w-14 h-14 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-1">Windows</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center">
              Compatible with Windows 10 and 11 (x86_64)
            </p>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <Clock weight="fill" className="w-4 h-4 text-amber-500" />
              <span>Coming soon</span>
            </div>

            <Button variant="outline" className="w-full gap-2" disabled>
              <DownloadSimple weight="bold" className="w-4 h-4" />
              Download for Windows
            </Button>
          </div>
        </div>

        {/* System requirements */}
        <div className="mt-16 text-center">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            System Requirements
          </h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <AppleLogo weight="fill" className="w-4 h-4" />
              <span>macOS 11.0 or later</span>
            </div>
            <div className="flex items-center gap-2">
              <WindowsLogo weight="fill" className="w-4 h-4" />
              <span>Windows 10/11 (coming soon)</span>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Start your free trial after downloading. No credit card required.
        </p>
      </main>
    </div>
  );
}
