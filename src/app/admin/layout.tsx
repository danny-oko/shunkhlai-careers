import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Мэдээний админ",
  // The desk is not for readers and must never turn up in a search result.
  robots: { index: false, follow: false },
};

/**
 * The paper ground, and nothing else.
 *
 * No guard here on purpose: this layout also wraps `/admin/login`, which has
 * to render for someone who is not signed in yet. The gate lives one level
 * down, in the `AdminShell` that `news/`, `content/` and `account/` each
 * mount from their own layout — the shell runs `requireAdminUser()` itself,
 * so the chrome and the check cannot be separated.
 *
 * `ChromeSlot` in the root layout takes the site header and footer away for
 * everything under `/admin`, so this owns the full height of the window.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div
      data-newsroom
      className="flex min-h-screen flex-1 flex-col bg-background text-foreground"
    >
      {children}
    </div>
  );
}
