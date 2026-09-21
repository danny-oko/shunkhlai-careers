import { redirect } from "next/navigation";

// The old regno/phone login is retired — Clerk is the front door now. The ERP
// credentials are collected once, after sign-in, in /account.
export default function LoginPage() {
  redirect("/sign-in");
}
