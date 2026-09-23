import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Бүртгүүлэх" };

/** The sign-in page's twin - see the note there. */
export default function SignUpPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/account" />
    </main>
  );
}
