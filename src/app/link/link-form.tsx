"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkAccountAction, type LinkState } from "./actions";

const initial: LinkState = { ok: false };

export function LinkForm({
  defaults,
}: {
  defaults: { firstname: string; lastname: string; email: string };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(linkAccountAction, initial);

  React.useEffect(() => {
    if (state.ok) router.refresh(); // re-render the page into its "linked" state
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="regno">Регистрийн дугаар *</Label>
        <Input id="regno" name="regno" required autoComplete="off" placeholder="УБ99010101" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone">Утасны дугаар / нууц үг *</Label>
        <Input id="phone" name="phone" required autoComplete="off" placeholder="99112233" />
        <p className="text-muted-foreground text-xs">
          ERP-д ашигладаг утас/нууц үгээ оруулна уу. Мэдээлэл шифрлэгдэж хадгалагдана.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="lastname">Эцэг/эхийн нэр</Label>
          <Input id="lastname" name="lastname" defaultValue={defaults.lastname} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="firstname">Нэр</Label>
          <Input id="firstname" name="firstname" defaultValue={defaults.firstname} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">И-мэйл</Label>
        <Input id="email" name="email" type="email" defaultValue={defaults.email} />
      </div>

      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Шалгаж байна…
          </>
        ) : (
          "Анкетаа холбох"
        )}
      </Button>
    </form>
  );
}
