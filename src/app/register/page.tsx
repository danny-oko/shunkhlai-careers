import { redirect } from "next/navigation";

// Retired in favour of Clerk sign-up; account data then lives in D1 (/account).
export default function RegisterPage() {
  redirect("/sign-up");
}
