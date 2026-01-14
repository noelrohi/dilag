"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { DOWNLOAD_URL } from "@/lib/constants";
import { Check, Copy } from "@phosphor-icons/react";
import type { LicenseKey } from "@/lib/polar";

interface SuccessContentProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
  licenseKey: LicenseKey | null;
  isFromDesktop: boolean;
}

export function SuccessContent({ user, licenseKey, isFromDesktop }: SuccessContentProps) {
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  // Auto-trigger deep link for desktop users
  useEffect(() => {
    if (isFromDesktop && licenseKey?.key && !opened) {
      setOpened(true);
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        window.location.href = `dilag://activate?key=${encodeURIComponent(licenseKey.key)}`;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isFromDesktop, licenseKey, opened]);

  const handleCopyKey = async () => {
    if (!licenseKey?.key) return;
    try {
      await navigator.clipboard.writeText(licenseKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleOpenInDilag = () => {
    if (!licenseKey?.key) return;
    window.location.href = `dilag://activate?key=${encodeURIComponent(licenseKey.key)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Subtle background glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[100px]" />
      </div>

      {/* Main content - vertically centered */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          {/* Animated success icon */}
          <div className="relative mb-8 inline-block">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline 
                  points="20 6 9 17 4 12" 
                  className="animate-[draw_0.5s_ease-out_0.3s_forwards]"
                  style={{ 
                    strokeDasharray: 24, 
                    strokeDashoffset: 24,
                  }}
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
            You&apos;re all set
          </h1>
          <p className="text-muted-foreground text-sm mb-10">
            {isFromDesktop 
              ? "Opening Dilag..." 
              : "Your trial is ready. Download the app to start designing."}
          </p>

          {/* License key - minimal display */}
          {licenseKey && (
            <div className="mb-8">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-2">
                License Key
              </p>
              <button
                onClick={handleCopyKey}
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <code className="text-sm font-mono text-foreground/80">
                  {licenseKey.key.slice(0, 8)}...{licenseKey.key.slice(-4)}
                </code>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </span>
              </button>
              {copied && (
                <p className="text-xs text-emerald-500 mt-2 animate-in fade-in">
                  Copied to clipboard
                </p>
              )}
            </div>
          )}

          {/* Primary action */}
          {isFromDesktop ? (
            <div className="space-y-4">
              <button
                onClick={handleOpenInDilag}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors"
              >
                Open Dilag
                <ArrowSquareOut weight="bold" className="w-4 h-4" />
              </button>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t work?{" "}
                <button
                  onClick={handleCopyKey}
                  className="text-foreground hover:underline"
                >
                  Copy the key
                </button>{" "}
                and paste it manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <a
                href={DOWNLOAD_URL}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors"
              >
                Download Dilag
              </a>
              <p className="text-xs text-muted-foreground">
                macOS &middot; Apple Silicon &amp; Intel
              </p>
            </div>
          )}

          {/* No license key state */}
          {!licenseKey && (
            <div className="text-sm text-muted-foreground">
              <p className="mb-4">
                Your license key is being generated...
              </p>
              <Link
                href="/dashboard"
                className="text-foreground hover:underline"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="py-6 text-center">
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Go to Dashboard
        </Link>
      </footer>

      {/* Checkmark animation keyframes */}
      <style jsx>{`
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
