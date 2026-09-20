import { applications } from "@/lib/api";
import {
  applicationWasCreated,
  buildApplicationInput,
  findDuplicateApplication,
  isPastDate,
  parseSalaryChoice,
} from "@/lib/jobs/apply";
import type { JobDetail } from "@/lib/jobs/types";

/**
 * The checks and the send behind the apply dialog. The backend answers success
 * for a posting that does not exist and accepts a second application to the
 * same one, so the applicant's list is read before and after
 * (`lib/jobs/apply.ts`) rather than trusting the response.
 */

export type ApplyForm = { salrequest: string; poshiredate: string; recsourceid: string };
export type SalaryOption = { key: number; text: string };
export type ApplyCheck = { ok: true; salaryKey: number | undefined } | { ok: false; message: string };

export const EMPTY_APPLY_FORM: ApplyForm = { salrequest: "", poshiredate: "", recsourceid: "" };

const DUPLICATE_MESSAGE =
  "Та энэ ажлын байранд анкет илгээсэн байна. Шинээр илгээхийг хүсвэл «Илгээсэн хүсэлт» хэсгээс өмнөхийг цуцална уу.";
const UNVERIFIED_MESSAGE =
  "Илгээгдсэн эсэхийг баталгаажуулж чадсангүй. «Илгээсэн хүсэлт» хэсгээс шалгана уу.";
const NOT_REGISTERED_MESSAGE = "Анкет бүртгэгдсэнгүй. Түр хүлээгээд дахин оролдоно уу.";

/** In the order the applicant meets them on the form; the first to fail wins. */
const REQUIRED_CHECKS: Array<[(form: ApplyForm) => boolean, string]> = [
  [(form) => !form.poshiredate, "Ажилд орох боломжтой огноогоо сонгоно уу."],
  [(form) => isPastDate(form.poshiredate), "Ажилд орох огноо өнөөдрөөс өмнө байж болохгүй."],
  [(form) => !form.recsourceid, "Зарыг хаанаас мэдсэнээ сонгоно уу."],
];

/** The salary choice first, then the required fields. */
export function validateApplyForm(form: ApplyForm, salaryOptions: SalaryOption[]): ApplyCheck {
  const salary = parseSalaryChoice(form.salrequest, salaryOptions);
  if (!salary.ok) return salary;
  const failed = REQUIRED_CHECKS.find(([isBad]) => isBad(form));
  return failed ? { ok: false, message: failed[1] } : { ok: true, salaryKey: salary.key };
}

/** `null` when the new application shows up in the applicant's list, else why not. */
async function verifyCreated(
  before: Awaited<ReturnType<typeof applications.listMine>>,
  job: JobDetail,
): Promise<string | null> {
  const after = await applications.listMine().catch(() => null);
  if (!after) return UNVERIFIED_MESSAGE;
  return applicationWasCreated(before, after, job) ? null : NOT_REGISTERED_MESSAGE;
}

/** `null` on a confirmed success, otherwise the message to show. Throws on transport errors. */
export async function sendApplication(
  job: JobDetail,
  form: ApplyForm,
  salaryKey: number | undefined,
): Promise<string | null> {
  const before = await applications.listMine();
  if (findDuplicateApplication(before, job)) return DUPLICATE_MESSAGE;

  await applications.apply(
    buildApplicationInput({
      postingId: Number(job.id),
      salaryKey,
      poshiredate: form.poshiredate,
      recsourceid: Number(form.recsourceid),
    }),
  );
  return verifyCreated(before, job);
}
