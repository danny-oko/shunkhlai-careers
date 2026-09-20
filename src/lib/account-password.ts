import { toast } from "sonner";

type Reply = { ok?: boolean; error?: string; relinkRequired?: boolean } | null;

const FALLBACK = "Нууц үг солих боломжгүй байна.";

const isOk = (res: Response, data: Reply) => res.ok && data?.ok === true;

const messageOf = (data: Reply) => data?.error || FALLBACK;

const announce = (data: Reply) => {
  toast.success("Нууц үг солигдлоо");
  if (data?.relinkRequired) {
    toast.warning("Нууц үг солигдсон ч дахин холбогдох шаардлагатай байна.");
  }
};

/**
 * Goes through the server route, not the ERP directly: the route also updates
 * the ERP credential the server re-logs in with. Throws the Mongolian message on refusal
 * and toasts on success (with a re-link warning when the follow-up login failed).
 */
export async function postPasswordChange(oldpassword: string, newpassword: string) {
  const res = await fetch("/api/erp/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldpassword, newpassword }),
  });
  const data: Reply = await res.json().catch(() => null);
  if (!isOk(res, data)) throw new Error(messageOf(data));
  announce(data);
}
