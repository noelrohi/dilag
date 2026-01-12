"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import {
  Button,
  Input,
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
} from "@dilag/ui";
import { DilagLogo } from "@/components/dilag-logo";
import { GoogleLogo, ArrowRight } from "@phosphor-icons/react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await signIn.social({ provider: "google", callbackURL: "/dashboard" });
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to sign in with Google");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      try {
        const result = await signIn.email({ email, password });
        if (result.error) {
          setError(result.error.message || "Sign in failed");
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        setError("An unexpected error occurred");
      }
    });
  };

  return (
    <div className="w-full max-w-sm space-y-8 animate-slide-in-right">
      {/* Mobile logo */}
      <div className="lg:hidden flex justify-center">
        <Link href="/" className="inline-flex items-center gap-3">
          <DilagLogo className="w-10 h-10" />
        </Link>
      </div>

      {/* Header */}
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-2 text-muted-foreground">
          Sign in to access your account
        </p>
      </div>

      {/* Google Sign In */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-3"
        onClick={handleGoogleSignIn}
      >
        <GoogleLogo weight="bold" className="w-5 h-5" />
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-muted-foreground/20" />
        <span className="text-sm text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-muted-foreground/20" />
      </div>

      {/* Email Form */}
      <form onSubmit={handleSubmit}>
        <FieldGroup className="gap-5">
          {error && <FieldError>{error}</FieldError>}

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </Field>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 gap-2"
          >
            {isPending ? (
              "Signing in..."
            ) : (
              <>
                Sign in
                <ArrowRight weight="bold" className="w-4 h-4" />
              </>
            )}
          </Button>
        </FieldGroup>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
