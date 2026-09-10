"use client";

import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";

import { displayName, useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { pictureSrc } from "@/lib/api/profile";

/**
 * The overview reads entirely from `/api/applicant/get`, which already returns
 * the completion percentages the HR system itself uses — no need to compute a
 * second, disagreeing number in the client.
 */

const meters = [
  { key: "persinfoper", label: "Хувийн мэдээлэл", href: "/account/profile" },
  { key: "educationper", label: "Боловсрол, ур чадвар", href: "/account/education" },
  { key: "experienceper", label: "Ажлын туршлага", href: "/account/experience" },
  { key: "familyper", label: "Гэр бүл", href: "/account/family" },
  { key: "distinctper", label: "Бусад мэдээлэл", href: "/account/interests" },
] as const;

export default function AccountOverviewPage() {
  const { profile } = useSession();
  const total = Number(profile?.totalper ?? 0);
  const photo = profile ? pictureSrc(profile) : null;

  return (
    <div className="space-y-10">
      <section className="border-border/70 flex flex-wrap items-center gap-5 rounded-xl border p-6">
        <span className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {photo ? (
            // The API returns Base64, so next/image would have nothing to optimise.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-muted-foreground text-lg font-medium">
              {displayName(profile).slice(0, 1) || "?"}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-[-0.02em]">
            {displayName(profile) || "Нэр оруулаагүй"}
          </p>
          <p className="text-muted-foreground text-sm">
            {profile?.regno} · {profile?.mobilephone || "утас оруулаагүй"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">{total}%</p>
          <p className="text-muted-foreground text-xs">анкет бөглөлт</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Бөглөлтийн байдал</h2>
        <ul className="space-y-3">
          {meters.map((meter) => {
            const value = Number(profile?.[meter.key] ?? 0);
            return (
              <li key={meter.key}>
                <Link
                  href={meter.href}
                  className="group hover:bg-muted/50 block rounded-lg px-3 py-2.5 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      {meter.label}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                    </span>
                    <span className="text-muted-foreground tabular-nums">{value}%</span>
                  </div>
                  <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, value))}%`,
                        backgroundImage: "var(--brand-gradient)",
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-border/70 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <FileText className="text-muted-foreground size-5" />
          <div>
            <p className="font-medium">CV</p>
            <p className="text-muted-foreground text-sm">
              {profile?.filename ? profile.filename : "Хавсаргаагүй байна."}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-9 rounded-full px-4">
          <Link href="/account/profile">{profile?.filename ? "Солих" : "Хавсаргах"}</Link>
        </Button>
      </section>
    </div>
  );
}
