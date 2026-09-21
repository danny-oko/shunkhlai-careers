import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";

import { getLink, getProfileSnapshot, syncProfile } from "@/server/erp/link";
import { LinkForm } from "./link-form";
import { ProfileEditForm } from "./profile-edit-form";

const str = (v: unknown): string => (v == null ? "" : String(v));

export const metadata = { title: "Анкетаа холбох" };

export default async function LinkPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const link = await getLink(userId);

  // Already linked → show the personal data we've saved in OUR D1 database.
  if (link?.status === "linked") {
    // Read the mirror from D1; if it's missing (older link), sync it now.
    let snapshot = await getProfileSnapshot(userId);
    let error: string | null = null;
    if (!snapshot) {
      try {
        const data = await syncProfile(userId);
        if (data) snapshot = { data, syncedAt: new Date() };
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    const p = (snapshot?.data ?? {}) as Record<string, unknown>;

    return (
      <main className="mx-auto w-full max-w-xl px-6 py-24">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Анкет холбогдсон</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Таны хувийн мэдээлэл манай өгөгдлийн санд (Cloudflare D1) хадгалагдсан.
          {snapshot ? (
            <>
              {" "}Сүүлд шинэчилсэн: {snapshot.syncedAt.toLocaleString("mn-MN")}.
            </>
          ) : null}
        </p>

        {error && !snapshot ? (
          <p className="mt-6 text-sm text-red-600">Алдаа: {error}</p>
        ) : (
          <>
            <dl className="mt-6 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
              <Row k="Регистр" v={p.regno} />
              <Row k="Утас" v={p.mobilephone} />
              <Row k="Улс" v={p.countryname} />
              <Row k="Бөглөлт" v={p.totalper != null ? `${p.totalper}%` : undefined} />
            </dl>

            <h2 className="mt-10 text-lg font-semibold tracking-[-0.01em]">
              Хувийн мэдээлэл засах
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Өөрчлөлт нь ERP (careers.shunkhlai.mn)-д бичигдэж, манай D1-д
              шинэчлэгдэнэ.
            </p>
            <ProfileEditForm
              initialValues={{
                lastname: str(p.lastname),
                firstname: str(p.firstname),
                email2: str(p.email2),
                addr2: str(p.addr2),
                maritalstatus: str(p.maritalstatus),
              }}
            />
          </>
        )}
      </main>
    );
  }

  const user = await currentUser();
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Анкетаа холбох</h1>
      <p className="text-muted-foreground mt-2 mb-8 text-sm">
        ERP (careers.shunkhlai.mn) дахь анкеттайгаа холбохын тулд регистр, утасны
        дугаараа оруулна уу. Мэдээллийг шалгаад шифрлэн хадгална.
      </p>
      {link?.status === "failed" && link.lastError === "credentials_unreadable" ? (
        <p role="status" className="-mt-4 mb-8 text-sm text-amber-700 dark:text-amber-400">
          Хадгалсан мэдээллийг уншиж чадсангүй. Регистр, утасны дугаараа дахин оруулна уу.
        </p>
      ) : null}
      <LinkForm
        defaults={{
          firstname: user?.firstName ?? "",
          lastname: user?.lastName ?? "",
          email: user?.primaryEmailAddress?.emailAddress ?? "",
        }}
      />
    </main>
  );
}

function Row({ k, v }: { k: string; v?: unknown }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v ? String(v) : "—"}</dd>
    </>
  );
}
