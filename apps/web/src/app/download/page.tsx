import { Button } from "@dilag/ui/button";
import { Badge } from "@dilag/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { DOWNLOAD_URL } from "@/lib/constants";
import { 
  DownloadSimple, 
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
            {/* Apple Logo */}
            <div className="w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5AC8FA] via-[#007AFF] to-[#5856D6] rounded-[22px] shadow-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="white" viewBox="0 0 16 16" className="w-16 h-16">
                  <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
                  <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
                </svg>
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
          <h3 className="text-sm font-sans font-medium text-muted-foreground uppercase tracking-wider mb-4">
            System Requirements
          </h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="w-4 h-4">
                <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282"/>
              </svg>
              <span className="font-sans">macOS 11.0 or later</span>
            </div>
            <div className="flex items-center gap-2">
              <WindowsLogo weight="fill" className="w-4 h-4" />
              <span className="font-sans">Windows 10/11 (coming soon)</span>
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
