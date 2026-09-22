"use client";

import { IdentityLock } from "@/components/account/identity-gate";
import { CvManager, PhotoUpload } from "@/components/account/profile-files";
import { ProfileForm } from "@/components/account/profile-form";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <div className="space-y-10">
      <section className="border-border/70 rounded-xl border p-6">
        <IdentityLock>
          <PhotoUpload />
        </IdentityLock>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">Хувийн мэдээлэл</h2>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Анкет илгээхэд шаардагдах үндсэн мэдээлэл.
        </p>
        <ProfileForm />
      </section>

      <Separator />

      <section className="border-border/70 rounded-xl border p-6">
        <IdentityLock>
          <CvManager />
        </IdentityLock>
      </section>
    </div>
  );
}
