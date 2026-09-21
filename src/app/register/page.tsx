import { redirect } from "next/navigation";

// Retired in favour of Clerk sign-up. ERP linking happens after, in /account.
export default function RegisterPage() {
  redirect("/sign-up");
}
