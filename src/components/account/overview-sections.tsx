"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { useRequestCount } from "@/components/account/use-request-count";
import { displayName } from "@/components/auth/session-provider";
import { pictureSrc, type ApplicantProfile } from "@/lib/api/profile";

type ProfileProps = { profile: ApplicantProfile };

const meters = [
  { key: "persinfoper", label: "Хувийн мэдээлэл", href: "/account/profile" },
  { key: "educationper", label: "Боловсрол, ур чадвар", href: "/account/education" },
  { key: "experienceper", label: "Ажлын туршлага", href: "/account/experience" },
  { key: "familyper", label: "Гэр бүл", href: "/account/family" },
  { key: "distinctper", label: "Бусад мэдээлэл", href: "/account/interests" },
] as const;

const Initial = ({ profile }: ProfileProps) => (
  <span className="text-muted-foreground text-lg font-medium">
    {displayName(profile).slice(0, 1) || "?"}
  </span>
);

const Avatar = ({ profile }: ProfileProps) => {
  const photo = pictureSrc(profile);
  if (!photo) return <Initial profile={profile} />;
  // The API returns Base64, so next/image would have nothing to optimise.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photo} alt="" className="size-full object-cover" />;
};

const Stat = ({ value, label }: { value: React.ReactNode; label: string }) => (
  <div className="text-right">
    <p className="text-3xl font-semibold tabular-nums">{value}</p>
    <p className="text-muted-foreground text-xs">{label}</p>
  </div>
);

const Identity = ({ profile }: ProfileProps) => (
  <div className="min-w-0 flex-1">
    <p className="text-lg font-semibold tracking-[-0.02em]">
      {displayName(profile) || "Нэр оруулаагүй"}
    </p>
    <p className="text-muted-foreground text-sm">
      {profile.regno} · {profile.mobilephone || "утас оруулаагүй"}
    </p>
  </div>
);

/** Name, completion %, and how many applications were sent — as on the old site. */
export const OverviewHeader = ({ profile }: ProfileProps) => {
  const requests = useRequestCount();

  return (
    <section className="border-border/70 flex flex-wrap items-center gap-5 rounded-xl border p-6">
      <span className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <Avatar profile={profile} />
      </span>
      <Identity profile={profile} />
      <Stat value={`${Number(profile.totalper ?? 0)}%`} label="Анкетын мэдээлэл" />
      <Stat value={requests ?? "–"} label="Хүсэлтийн тоо" />
    </section>
  );
};

const Meter = ({ profile, meter }: ProfileProps & { meter: (typeof meters)[number] }) => {
  const value = Number(profile[meter.key] ?? 0);

  return (
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
  );
};

export const OverviewMeters = ({ profile }: ProfileProps) => (
  <section className="space-y-4">
    <h2 className="text-lg font-semibold tracking-[-0.02em]">Бөглөлтийн байдал</h2>
    <ul className="space-y-3">
      {meters.map((meter) => (
        <li key={meter.key}>
          <Meter profile={profile} meter={meter} />
        </li>
      ))}
    </ul>
  </section>
);
