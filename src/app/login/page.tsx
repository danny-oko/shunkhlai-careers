import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Нэвтрэх",
  description: "Шунхлай Careers-т нэвтэрч анкетаа бөглөнө үү.",
};

export default function LoginPage() {
  return (
    <main className="flex-1 pt-16">
      <div className="mx-auto w-full max-w-md px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Нэвтрэх</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Анкетаа үргэлжлүүлэн бөглөх, илгээсэн хүсэлтээ хянахын тулд нэвтэрнэ үү.
        </p>

        <div className="mt-8">
          <Suspense fallback={null}>
            <AuthForm mode="signin" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
