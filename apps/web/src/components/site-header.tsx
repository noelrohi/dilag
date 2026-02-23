import Link from "next/link";
import { Button } from "@dilag/ui/button";
import { DilagLogo } from "./dilag-logo";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";

export function SiteHeader() {
  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
      <nav className="flex items-center justify-between h-14 px-4 rounded-full bg-card/80 backdrop-blur-xl border border-border shadow-lg">
        <Link href="/" className="flex items-center gap-2.5 group">
          <DilagLogo className="w-7 h-7 transition-transform group-hover:scale-105" />
          <span className="font-semibold tracking-tight">Dilag</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" asChild>
            <Link href="/faq">FAQ</Link>
          </Button>
          <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground" asChild>
            <a href="https://github.com/noelrohi/dilag" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </Button>
        </div>

        <Button size="sm" className="rounded-full" asChild>
          <Link href="/download">
            <DownloadSimple weight="bold" className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </Link>
        </Button>
      </nav>
    </header>
  );
}
