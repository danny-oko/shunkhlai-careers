"use client";

import { Trash2 } from "lucide-react";

import { deleteArticleAction } from "@/app/admin/news/actions";
import { Button } from "@/components/ui/button";

/**
 * Delete, behind a confirmation.
 *
 * A client component for one reason: the confirm is an event handler, and a
 * handler cannot cross the server/client boundary. The check itself is the
 * browser's own dialog rather than a modal component — this is the only
 * irreversible control on the desk, and the native dialog is the one thing on
 * the page that cannot be dismissed by accident.
 *
 * The action still runs even if the confirm is somehow bypassed, so nothing
 * about authorisation depends on this component.
 */
export function DeleteArticleButton({ id, title }: { id: string; title: string }) {
  return (
    <form action={deleteArticleAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="destructive"
        size="sm"
        onClick={(event) => {
          if (!window.confirm(`“${title}” мэдээг хасах уу? Үүнийг буцаах боломжгүй.`)) {
            event.preventDefault();
          }
        }}
      >
        <Trash2 aria-hidden />
        Хасах
      </Button>
    </form>
  );
}
