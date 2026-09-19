import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Нэвтрэх" };

export default function SignInPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/link" />
    </main>
  );
}
