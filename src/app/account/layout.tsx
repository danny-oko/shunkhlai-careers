"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { retryErpSession, useErpBridgeStatus } from "@/components/auth/clerk-erp-bridge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/account", label: "Ерөнхий" },
  { href: "/account/profile", label: "Хувийн мэдээлэл" },
  { href: "/account/education", label: "Боловсрол, ур чадвар" },
  { href: "/account/experience", label: "Ажлын туршлага" },
  { href: "/account/family", label: "Гэр бүл" },
  { href: "/account/interests", label: "Сонирхож буй ажил" },
  { href: "/account/applications", label: "Илгээсэн хүсэлт" },
];

/** Everything under /account needs a session; anonymous visitors go to sign-in. */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  const { status } = useSession();
  const { isLoaded, isSignedIn } = useAuth();
  const bridgeStatus = useErpBridgeStatus();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    // Only bounce to sign-in when Clerk itself is signed out. If Clerk is signed
    // in but the app session isn't ready yet, the ClerkErpBridge is either
    // establishing it or redirecting to /link — so we wait instead of bouncing.
    if (isLoaded && !isSignedIn && status !== "authenticated") {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, status, router]);

  if (status !== "authenticated" && (bridgeStatus === "error" || bridgeStatus === "relink")) {
    const relink = bridgeStatus === "relink";
    return (
      <main className="flex flex-1 items-center justify-center pt-16">
        <div role="alert" className="flex flex-col items-center gap-3 py-32 text-center text-sm">
          <p className="text-muted-foreground">
            {relink ? "Анкетаа дахин холбох шаардлагатай." : "Алдаа гарлаа. Дахин оролдоно уу."}
          </p>
          <div className="flex items-center gap-2">
            {relink ? (
              <Button asChild size="sm" className="rounded-full px-3">
                <Link href="/link">Анкетаа холбох</Link>
              </Button>
            ) : (
              <>
                <Button size="sm" className="rounded-full px-3" onClick={retryErpSession}>
                  Дахин оролдох
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-full px-3">
                  <Link href="/link">Анкетаа холбох</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex flex-1 items-center justify-center pt-16">
        <p className="text-muted-foreground flex items-center gap-2 py-32 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Ачаалж байна…
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 pt-16">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Миний анкет</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Бөглөсөн мэдээлэл тань илгээх анкет бүрт автоматаар хавсрагдана.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
          <nav aria-label="Анкетын хэсгүүд">
            <ul className="flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0">
              {sections.map((section) => {
                const isActive =
                  section.href === "/account"
                    ? pathname === "/account"
                    : pathname.startsWith(section.href);

                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      className={cn(
                        "block shrink-0 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                        isActive
                          ? "bg-foreground text-background font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  );
}
