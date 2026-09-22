"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * What the desk shows when a render or a save throws.
 *
 * Without it an error in a server action — a request the server refused before
 * the action ran, a full disk — fell through to Next's generic English page
 * and took the admin bar with it. This sits under `news/layout.tsx`, so the bar
 * and the way out stay on screen.
 */
export default function AdminNewsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error("[admin/news]", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-16 lg:px-8">
      <div role="alert" className="border border-destructive/30 bg-destructive/10 p-6">
        <p className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle aria-hidden className="size-4" />
          Алдаа гарлаа. Үйлдэл хийгдсэнгүй.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Дахин оролдоно уу. Алдаа давтагдвал зургийн хэмжээ болон бичвэрийн уртыг
          шалгана уу.
          {error.digest && (
            <span className="mt-1 block font-mono text-xs">Код: {error.digest}</span>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => retry()}>
            <RotateCcw aria-hidden />
            Дахин оролдох
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/news">Мэдээний удирдлага</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
