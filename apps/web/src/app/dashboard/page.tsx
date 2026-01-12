"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession, signOut, authClient } from "@/lib/auth-client";
import { ExternalLink } from "lucide-react";

interface Order {
  id: string;
  productId: string;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // Check if user has purchased the product
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: async () => {
      const res = await authClient.customer.orders.list({
        query: { limit: 100 },
      });
      // Response structure: { result: { items: [...] } }
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
            <span className="text-sm text-neutral-400">
              {session.user.email}
            </span>
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
          <p className="mt-1 text-neutral-400">Manage your Dilag account</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Account</h2>
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400">
                  {session.user.name?.charAt(0) ||
                    session.user.email?.charAt(0) ||
                    "?"}
                </div>
              )}
              <div>
                <p className="font-medium">{session.user.name || "User"}</p>
                <p className="text-sm text-neutral-400">{session.user.email}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">License</h2>
          {ordersLoading ? (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <p className="text-neutral-400">Loading...</p>
            </div>
          ) : hasPurchased ? (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-green-400">
                    Pro License Active
                  </p>
                  <p className="text-sm text-neutral-400">
                    You have full access to all features
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800">
                <button
                  onClick={handleOpenPortal}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Manage License
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg">
              <p className="text-neutral-400 mb-4">
                Purchase a Pro license for lifetime access to all features.
              </p>
              <button
                onClick={handleUpgrade}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Purchase Pro License
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
