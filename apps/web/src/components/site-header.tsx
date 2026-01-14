"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@dilag/ui";
import { DilagLogo } from "./dilag-logo";
import { 
  Sparkle,
  User,
  SignOut,
} from "@phosphor-icons/react";

interface SiteHeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  onSignOut?: () => void;
}

export function SiteHeader({ user, onSignOut }: SiteHeaderProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const isAuthPage = pathname === "/sign-in" || pathname === "/sign-up";

  // Don't show header on auth pages
  if (isAuthPage) return null;

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4">
      <nav className="flex items-center justify-between h-14 px-4 rounded-full bg-card/80 backdrop-blur-xl border border-border shadow-lg">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <DilagLogo className="w-7 h-7 transition-transform group-hover:scale-105" />
          <span className="font-semibold tracking-tight">Dilag</span>
        </Link>

        {/* Center nav */}
        {!isDashboard && (
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
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!isDashboard && (
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link href="/dashboard">
                    <User weight="bold" className="w-4 h-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </Button>
              )}
              {onSignOut && (
                <Button variant="ghost" size="sm" className="rounded-full" onClick={onSignOut}>
                  <SignOut weight="bold" className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="rounded-full" asChild>
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button size="sm" className="rounded-full" asChild>
                <Link href="/sign-up">
                  <Sparkle weight="bold" className="w-4 h-4" />
                  <span className="hidden sm:inline">Start Trial</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
