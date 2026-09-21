import { redirect } from "next/navigation";

// The old regno/phone login is retired — Clerk is the front door now, and the
// applicant's account data lives in D1, keyed by their Clerk email.
export default function LoginPage() {
  redirect("/sign-in");
}
