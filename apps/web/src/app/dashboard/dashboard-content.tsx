"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { signOut, authClient } from "@/lib/auth-client";
import { Button } from "@dilag/ui";
import { Badge } from "@dilag/ui";
import { Separator } from "@dilag/ui";
import { SiteHeader } from "@/components/site-header";
import { DOWNLOAD_URL } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  ArrowDown,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  Check,
  Crown,
  Key,
} from "@phosphor-icons/react";
import type { LicenseKey } from "@/lib/polar";

interface Order {
  id: string;
  productId: string;
  [key: string]: unknown;
}

interface DashboardContentProps {
  user: {
    name: string | null;
    email: string;
    image?: string | null;
  };
  licenseKey: LicenseKey | null;
}

function maskLicenseKey(key: string): string {
  // Show first 10 chars, mask the rest with asterisks
  if (key.length <= 10) return key;
  return key.slice(0, 10) + "*".repeat(Math.min(key.length - 10, 20));
}

export function DashboardContent({ user, licenseKey }: DashboardContentProps) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: async () => {
      const res = await authClient.customer.orders.list({
        query: { limit: 100 },
      });
      const data = res.data as { result?: { items?: Order[] } } | undefined;
      return data?.result?.items ?? [];
    },
  });

  const hasPurchased = orders.some(
    (order) => order.productId === process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID
  );

  const handleOpenPortal = async () => {
    await authClient.customer.portal();
  };

  const handleCopyLicenseKey = async () => {
    if (!licenseKey) return;
    await navigator.clipboard.writeText(licenseKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleUpgrade = async () => {
    await authClient.checkout({ slug: "pro" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <SiteHeader user={user} onSignOut={handleSignOut} />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        {/* Profile section */}
        <Item variant="outline" className="mb-10">
          <ItemMedia>
            <Avatar className="size-12 border border-border">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? "User"}
              />
              <AvatarFallback>
                {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-base">{user.name || "User"}</ItemTitle>
            <ItemDescription>{user.email}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </ItemActions>
        </Item>

        <Separator className="mb-8" />

        {/* License status */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            License
          </h2>

          {ordersLoading ? (
            <Item variant="muted" size="sm">
              <ItemMedia variant="icon">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Checking license</ItemTitle>
                <ItemDescription>Fetching your latest status.</ItemDescription>
              </ItemContent>
            </Item>
          ) : hasPurchased ? (
            <ItemGroup className="gap-3">
              <Item variant="outline">
                <ItemMedia
                  variant="icon"
                  className="bg-emerald-500/10 text-emerald-500"
                >
                  <CheckCircle weight="fill" className="w-5 h-5" />
                </ItemMedia>
                <ItemContent className="gap-2">
                  <ItemHeader className="items-start">
                    <ItemTitle>Pro License</ItemTitle>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-emerald-500/10 text-emerald-500 border-0"
                    >
                      Active
                    </Badge>
                  </ItemHeader>
                  <ItemDescription>
                    Full access to all features.
                  </ItemDescription>
                  <ItemFooter className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPortal}
                      className="gap-2"
                    >
                      Manage subscription
                      <ArrowSquareOut weight="bold" className="w-4 h-4" />
                    </Button>
                  </ItemFooter>
                </ItemContent>
              </Item>

              {licenseKey && (
                <Item variant="outline">
                  <ItemMedia variant="icon">
                    <Key weight="duotone" className="w-5 h-5 text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent className="gap-2">
                    <ItemHeader>
                      <ItemTitle>License Key</ItemTitle>
                    </ItemHeader>
                    <ItemDescription className="font-mono text-xs break-all">
                      {maskLicenseKey(licenseKey.key)}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLicenseKey}
                      className="h-8 w-8"
                    >
                      {copied ? (
                        <Check weight="bold" className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy weight="bold" className="w-4 h-4" />
                      )}
                    </Button>
                  </ItemActions>
                </Item>
              )}
            </ItemGroup>
          ) : (
            <ItemGroup className="gap-3">
              <Item variant="outline">
                <ItemMedia variant="icon">
                  <Crown
                    weight="duotone"
                    className="w-5 h-5 text-muted-foreground"
                  />
                </ItemMedia>
                <ItemContent className="gap-2">
                  <ItemHeader className="items-start">
                    <ItemTitle>Free Trial</ItemTitle>
                    <Badge variant="outline" className="text-xs">
                      Limited
                    </Badge>
                  </ItemHeader>
                  <ItemDescription>
                    Upgrade to unlock all features.
                  </ItemDescription>
                  <ItemFooter className="pt-1">
                    <Button size="sm" onClick={handleUpgrade} className="gap-2">
                      <Crown weight="fill" className="w-4 h-4" />
                      Upgrade to Pro
                    </Button>
                  </ItemFooter>
                </ItemContent>
              </Item>
            </ItemGroup>
          )}
        </section>

        <Separator className="mb-8" />

        {/* Quick actions */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Quick Actions
          </h2>

          <ItemGroup className="gap-3">
            <Item variant="outline" asChild>
              <a href={DOWNLOAD_URL}>
                <ItemMedia variant="icon" className="text-primary">
                  <ArrowDown weight="duotone" className="w-5 h-5" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Download Dilag</ItemTitle>
                  <ItemDescription>
                    macOS (Apple Silicon & Intel)
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowSquareOut
                    weight="bold"
                    className="w-4 h-4 text-muted-foreground"
                  />
                </ItemActions>
              </a>
            </Item>
          </ItemGroup>
        </section>
      </main>
    </div>
  );
}
