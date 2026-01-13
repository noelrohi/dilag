"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession, signOut, authClient } from "@/lib/auth-client";
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
  Crown,
} from "@phosphor-icons/react";

interface Order {
  id: string;
  productId: string;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: async () => {
      const res = await authClient.customer.orders.list({
        query: { limit: 100 },
      });
      const data = res.data as { result?: { items?: Order[] } } | undefined;
      return data?.result?.items ?? [];
    },
    enabled: !!session,
  });

  const hasPurchased = orders.some(
    (order) => order.productId === process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID,
  );

  const handleOpenPortal = async () => {
    await authClient.customer.portal();
  };

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleUpgrade = async () => {
    await authClient.checkout({ slug: "pro" });
  };

  if (isPending || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <SiteHeader 
        user={session.user} 
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-6 pt-28 pb-16">
        {/* Profile section */}
        <Item variant="outline" className="mb-10">
          <ItemMedia>
            <Avatar className="size-12 border border-border">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "User"} />
              <AvatarFallback>
                {session.user.name?.charAt(0) ||
                  session.user.email?.charAt(0) ||
                  "?"}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-base">{session.user.name || "User"}</ItemTitle>
            <ItemDescription>{session.user.email}</ItemDescription>
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
                <ItemMedia variant="icon" className="bg-emerald-500/10 text-emerald-500">
                  <CheckCircle weight="fill" className="w-5 h-5" />
                </ItemMedia>
                <ItemContent className="gap-2">
                  <ItemHeader className="items-start">
                    <ItemTitle>Pro License</ItemTitle>
                    <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500 border-0">
                      Active
                    </Badge>
                  </ItemHeader>
                  <ItemDescription>Full access to all features.</ItemDescription>
                  <ItemFooter className="pt-1">
                    <Button variant="outline" size="sm" onClick={handleOpenPortal} className="gap-2">
                      Manage subscription
                      <ArrowSquareOut weight="bold" className="w-4 h-4" />
                    </Button>
                  </ItemFooter>
                </ItemContent>
              </Item>
            </ItemGroup>
          ) : (
            <ItemGroup className="gap-3">
              <Item variant="outline">
                <ItemMedia variant="icon">
                  <Crown weight="duotone" className="w-5 h-5 text-muted-foreground" />
                </ItemMedia>
                <ItemContent className="gap-2">
                  <ItemHeader className="items-start">
                    <ItemTitle>Free Trial</ItemTitle>
                    <Badge variant="outline" className="text-xs">Limited</Badge>
                  </ItemHeader>
                  <ItemDescription>Upgrade to unlock all features.</ItemDescription>
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
                  <ItemDescription>macOS (Apple Silicon & Intel)</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowSquareOut weight="bold" className="w-4 h-4 text-muted-foreground" />
                </ItemActions>
              </a>
            </Item>
          </ItemGroup>
        </section>
      </main>
    </div>
  );
}
