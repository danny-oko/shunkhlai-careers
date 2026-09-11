"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useDropdown } from "@/components/account/use-dropdown";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Select } from "@/components/ui/native-select";
import { applications, reference, toApiError } from "@/lib/api";
import type { InterestedJobRow } from "@/lib/api/applications";

/**
 * Interested roles — a standing request to be told when a matching vacancy
 * opens. A group alone is enough; the position narrows it.
 *
 * `getPositionsDropdown` rows carry `posgroupid` and `depid`, so the position
 * list is filtered client-side by the chosen group and the department id is
 * taken from the position rather than asked for separately.
 */
export default function InterestsPage() {
  const [isAdding, setIsAdding] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [group, setGroup] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const groups = useDropdown(() => reference.positionGroups(), []);
  const positions = useDropdown(() => reference.positions(), []);

  const visiblePositions = React.useMemo(
    () =>
      group
        ? positions.options.filter((option) => String(option.raw.posgroupid) === group)
        : positions.options,
    [positions.options, group],
  );

  const [token, setToken] = React.useState(0);
  const [loaded, setLoaded] = React.useState<{ token: number; rows: InterestedJobRow[] } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    applications.listInterests()
      .then((rows) => {
        if (cancelled) return;
        setLoaded({ token, rows });
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setLoaded({ token, rows: [] });
        setError(toApiError(loadError).message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const rows = loaded?.rows ?? [];
  const isLoading = loaded?.token !== token;

  /** Handlers call this after a write; effects never do. */
  const reload = React.useCallback(async () => {
    setToken((current) => current + 1);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!group) {
      setError("Албан тушаалын бүлгээ сонгоно уу.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const chosen = visiblePositions.find((option) => option.value === position);
      await applications.saveInterest({
        entryid: 0,
        posgroupid: Number(group),
        positionid: position ? Number(position) : null,
        depid: chosen?.raw.depid ? String(chosen.raw.depid) : null,
      });
      toast.success("Сонирхол бүртгэгдлээ");
      setIsAdding(false);
      setGroup("");
      setPosition("");
      await reload();
    } catch (saveError) {
      setError(toApiError(saveError).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(row: InterestedJobRow) {
    if (!window.confirm("Энэ бүртгэлийг устгах уу?")) return;
    try {
      await applications.deleteInterest(Number(row.entryid));
      toast.success("Устгалаа");
      await reload();
    } catch (removeError) {
      toast.error(toApiError(removeError).message);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Сонирхож буй ажлын байр</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Тохирох ажлын байр нээгдэхэд танд мэдэгдэнэ.
          </p>
        </div>
        {!isAdding ? (
          <Button
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="h-9 rounded-full px-4"
          >
            <Plus className="size-4" />
            Нэмэх
          </Button>
        ) : null}
      </div>

      {isAdding ? (
        <form
          onSubmit={onSubmit}
          className="border-border/70 bg-muted/30 space-y-5 rounded-xl border p-5"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Албан тушаалын бүлэг" htmlFor="posgroup" required>
              <Select
                id="posgroup"
                value={group}
                disabled={groups.isLoading}
                onChange={(event) => {
                  setGroup(event.target.value);
                  setPosition("");
                }}
              >
                <option value="">{groups.isLoading ? "Ачаалж байна…" : "— Сонгох —"}</option>
                {groups.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Албан тушаал"
              htmlFor="position"
              hint="Заавал биш — бүлгээр нь бүртгүүлж болно."
            >
              <Select
                id="position"
                value={position}
                disabled={positions.isLoading}
                onChange={(event) => setPosition(event.target.value)}
              >
                <option value="">— Бүх албан тушаал —</option>
                {visiblePositions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <FormMessage message={error} />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSaving} className="h-9 rounded-full px-5">
              {isSaving ? <Loader2 className="animate-spin" /> : null}
              Хадгалах
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsAdding(false)}
              className="h-9 rounded-full px-5"
            >
              Болих
            </Button>
          </div>
        </form>
      ) : null}

      {!isAdding ? <FormMessage message={error} /> : null}

      {isLoading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Ачаалж байна…
        </p>
      ) : rows.length === 0 ? (
        <p className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-5 py-8 text-center text-sm">
          Одоогоор сонирхсон ажлын байр бүртгүүлээгүй байна.
        </p>
      ) : (
        <ul className="border-border/70 divide-border/70 divide-y rounded-xl border">
          {rows.map((row) => (
            <li
              key={String(row.entryid)}
              className="flex items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {row.positionname || row.posgroupname || "Ажлын байр"}
                </p>
                {row.positionname && row.posgroupname ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">
                    {row.posgroupname}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Устгах"
                onClick={() => remove(row)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
