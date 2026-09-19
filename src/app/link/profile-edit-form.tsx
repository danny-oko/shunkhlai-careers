"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction, type ProfileState } from "./actions";

const initial: ProfileState = { ok: false };

const MARITAL = [
  { value: "", label: "—" },
  { value: "M", label: "Гэрлэсэн" },
  { value: "U", label: "Гэрлээгүй" },
  { value: "W", label: "Бэлэвсэн" },
  { value: "K", label: "Тодорхойгүй" },
];

export type ProfileEditValues = {
  lastname: string;
  firstname: string;
  email2: string;
  addr2: string;
  maritalstatus: string;
};

export function ProfileEditForm({ initialValues }: { initialValues: ProfileEditValues }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const lastSaved = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    // On a successful save, re-read the page so the D1 mirror shows the update.
    if (state.ok && state.savedAt && state.savedAt !== lastSaved.current) {
      lastSaved.current = state.savedAt;
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="lastname">Овог</Label>
          <Input id="lastname" name="lastname" defaultValue={initialValues.lastname} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="firstname">Нэр</Label>
          <Input id="firstname" name="firstname" defaultValue={initialValues.firstname} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email2">И-мэйл</Label>
        <Input id="email2" name="email2" type="email" defaultValue={initialValues.email2} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="addr2">Гэрийн хаяг</Label>
        <Input id="addr2" name="addr2" defaultValue={initialValues.addr2} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="maritalstatus">Гэрлэлтийн байдал</Label>
        <select
          id="maritalstatus"
          name="maritalstatus"
          defaultValue={initialValues.maritalstatus}
          className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-3"
        >
          {MARITAL.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {state.ok && state.savedAt ? (
        <p className="text-sm text-green-600">Хадгалагдлаа ✓ (ERP + манай D1-д шинэчлэгдсэн)</p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Хадгалж байна…
          </>
        ) : (
          "Хадгалах"
        )}
      </Button>
    </form>
  );
}
