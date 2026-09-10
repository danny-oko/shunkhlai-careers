import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Бүртгүүлэх",
  description: "Шунхлай Careers-т бүртгүүлж анкетаа үүсгэнэ үү.",
};

export default function RegisterPage() {
  return (
    <main className="flex-1 pt-16">
      <div className="mx-auto w-full max-w-md px-6 py-20">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Бүртгүүлэх</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Нэг удаа бүртгүүлээд бүх нээлттэй ажлын байранд анкетаа илгээх боломжтой.
        </p>

        <div className="mt-8">
          <Suspense fallback={null}>
            <AuthForm mode="signup" />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
