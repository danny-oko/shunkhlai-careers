import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Нэвтрэх" };

/**
 * The card's own skin and its Mongolian strings come from the provider in
 * `src/app/layout.tsx`, so this page is only the room it stands in.
 *
 * `py-24` rather than the site's fluid `py-section`: the header is `fixed`, and
 * at phone width that step floors at 48px - less than the 64px the header
 * occupies, which slides the top of the card underneath it. The rest of the
 * site clears the same header with a flat `pt-16`.
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </main>
  );
}
