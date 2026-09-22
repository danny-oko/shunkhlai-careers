"use client";

import {
  OverviewCv,
  OverviewHeader,
  OverviewMeters,
} from "@/components/account/overview-sections";
import { useSession } from "@/components/auth/session-provider";

/**
 * The overview reads entirely from `/api/applicant/get`, which already returns
 * the completion percentages the HR system itself uses — no need to compute a
 * second, disagreeing number in the client. The application count is the one
 * exception: it is the length of the applications list.
 */
export default function AccountOverviewPage() {
  const { profile: loaded } = useSession();
  const profile = loaded ?? {};

  return (
    <div className="space-y-10">
      <OverviewHeader profile={profile} />
      <OverviewMeters profile={profile} />
      <OverviewCv profile={profile} />
    </div>
  );
}
