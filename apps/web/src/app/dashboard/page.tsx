"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession, signOut, authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const { data: benefits = [], isLoading: benefitsLoading } = useQuery({
    queryKey: ["customer", "benefits"],
    queryFn: async () => {
      const res = await authClient.customer.benefits.list({ query: { limit: 100 } });
      // Response is a paginated list - data contains the result directly
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!session,
  });

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["customer", "subscriptions"],
    queryFn: async () => {
      const res = await authClient.customer.subscriptions.list({ query: { limit: 100, active: true } });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleOpenPortal = async () => {
    await authClient.customer.portal();
  };

  const loading = benefitsLoading || subscriptionsLoading;

  if (isPending || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold">
            Dilag
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome, {session.user.name || "User"}
          </h1>
          <p className="mt-1 text-neutral-400">
            Manage your Dilag subscription and benefits
          </p>
        </div>

        {/* Subscriptions */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Subscriptions</h2>
          {loading ? (
            <div className="p-4 bg-neutral-900 rounded-lg text-neutral-400">
              Loading...
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{sub.product?.name ?? "Subscription"}</h3>
                      <p className="text-sm text-neutral-400">
                        Status:{" "}
                        <span className={sub.status === "active" ? "text-green-400" : "text-yellow-400"}>
                          {sub.status}
                        </span>
                      </p>
                    </div>
                    {sub.cancelAtPeriodEnd && (
                      <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                        Cancels at period end
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <p className="text-neutral-400">No active subscriptions</p>
              <button
                onClick={() => authClient.checkout({ slug: "pro" })}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </section>

        {/* Benefits */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Benefits</h2>
          {loading ? (
            <div className="p-4 bg-neutral-900 rounded-lg text-neutral-400">
              Loading...
            </div>
          ) : benefits.length > 0 ? (
            <div className="grid gap-3">
              {benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium capitalize">{benefit.type.replace(/_/g, " ")}</p>
                      <p className="text-sm text-neutral-400">{benefit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <p className="text-neutral-400">No benefits yet</p>
            </div>
          )}
        </section>

        <section className="pt-4">
          <button
            onClick={handleOpenPortal}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Manage Subscription in Polar Portal
          </button>
        </section>
      </main>
    </div>
  );
}
