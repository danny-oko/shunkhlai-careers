"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

import {
  ApplicationCountProvider,
  useApplicationCount,
} from "@/components/account/application-count";
import { IdentityLock, IdentityPanel } from "@/components/account/identity-gate";
import { useSession } from "@/components/auth/session-provider";
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

/**
 * Everything under /account needs a Clerk session: spinner while Clerk loads,
 * signed-out visitors go to sign-in, signed-in ones get their D1 account.
 */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  const { status } = useSession();
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

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
    <ApplicationCountProvider>
      <AccountShell pathname={pathname}>{children}</AccountShell>
    </ApplicationCountProvider>
  );
}

function AccountShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { count } = useApplicationCount();

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
                const badge = section.href === "/account/applications" ? count : null;
                const isActive =
                  section.href === "/account"
                    ? pathname === "/account"
                    : pathname.startsWith(section.href);

                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      className={cn(
                        "flex shrink-0 items-center justify-between gap-2 rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                        isActive
                          ? "bg-foreground text-background font-medium"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {section.label}
                      {badge ? (
                        <span
                          aria-label={`${badge} хүсэлт`}
                          className={cn(
                            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums",
                            isActive ? "bg-background text-foreground" : "bg-foreground text-background",
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0">
            {/* The profile form carries the four fields itself: notice only, and it locks its files only. */}
            {pathname.startsWith("/account/profile") ? (
              <>
                <IdentityPanel withForm={false} />
                {children}
              </>
            ) : (
              <>
                <IdentityPanel />
                <IdentityLock>{children}</IdentityLock>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
