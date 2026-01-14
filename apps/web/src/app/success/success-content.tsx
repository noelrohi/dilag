"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@dilag/ui";
import { SiteHeader } from "@/components/site-header";
import { DilagLogo } from "@/components/dilag-logo";
import { DOWNLOAD_URL } from "@/lib/constants";
import {
  CheckCircle,
  Copy,
  Check,
  ArrowSquareOut,
  DownloadSimple,
  Key,
} from "@phosphor-icons/react";
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
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 grain" />
      </div>

      <SiteHeader user={user} />

      <main className="max-w-lg mx-auto px-6 pt-28 pb-16">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-6">
            <CheckCircle weight="fill" className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            You&apos;re all set!
          </h1>
          <p className="text-muted-foreground">
            {isFromDesktop
              ? "Your trial has started. Open Dilag to begin designing."
              : "Your trial has started. You can now use Dilag."}
          </p>
        </div>

        {/* License key card */}
        {licenseKey && (
          <div className="rounded-2xl border border-border bg-card/50 p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key weight="duotone" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Your License Key</h2>
                <p className="text-sm text-muted-foreground">
                  Use this to activate Dilag
                </p>
              </div>
            </div>

            {/* License key display */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 font-mono text-sm mb-4">
              <code className="flex-1 truncate">{licenseKey.key}</code>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={handleCopyKey}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Actions */}
            {isFromDesktop ? (
              <Button className="w-full gap-2" onClick={handleOpenInDilag}>
                <DilagLogo className="w-4 h-4" />
                Open in Dilag
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <a href={DOWNLOAD_URL}>
                    <DownloadSimple weight="bold" className="w-4 h-4" />
                    Download
                  </a>
                </Button>
                <Button className="flex-1 gap-2" onClick={handleCopyKey}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Key
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* No license key - show download/dashboard links */}
        {!licenseKey && (
          <div className="rounded-2xl border border-border bg-card/50 p-6 mb-6 text-center">
            <p className="text-muted-foreground mb-4">
              Your license key will be available shortly. Check your email or visit the dashboard.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <a href={DOWNLOAD_URL}>
                  <DownloadSimple weight="bold" className="w-4 h-4 mr-2" />
                  Download
                </a>
              </Button>
              <Button className="flex-1" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Help text for desktop flow */}
        {isFromDesktop && licenseKey && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            Didn&apos;t open?{" "}
            <button
              onClick={handleCopyKey}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Copy the key
            </button>{" "}
            and paste it in Dilag manually.
          </p>
        )}

        {/* Links */}
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Go to Dashboard
            <ArrowSquareOut weight="bold" className="w-3 h-3" />
          </Link>
        </div>
      </main>
    </div>
  );
}
