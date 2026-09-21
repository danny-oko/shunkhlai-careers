"use client";

import { CvManager, PhotoUpload } from "@/components/account/profile-files";
import { ProfileForm } from "@/components/account/profile-form";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <div className="space-y-10">
      <section className="border-border/70 rounded-xl border p-6">
        <PhotoUpload />
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
        <CvManager />
      </section>
    </div>
  );
}
