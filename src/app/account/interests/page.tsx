"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AsyncCombobox } from "@/components/account/async-combobox";
import { useDropdown } from "@/components/account/use-dropdown";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { applications, reference, stripCode, toApiError } from "@/lib/api";
import type { DropdownOption, DropdownQuery } from "@/lib/api";
import type { InterestedJobRow } from "@/lib/api/applications";
import {
  INTEREST_DUPLICATE_MESSAGE,
  INTEREST_GROUP_REQUIRED_MESSAGE,
  sameInterest,
} from "@/lib/interested-job";

/**
 * Interested roles — a standing request to be told when a matching vacancy
 * opens. A group alone is enough; the position narrows it.
 *
 * `getPositionsDropdown` is the one dependent list the backend does not filter:
 * it takes no group parameter, so the rows (744 live) are narrowed here, on
 * each row's own `posgroupid`, and the department id is read off the chosen
 * row rather than asked for separately. `posgroupid` arrives as a number and
 * `depid` as a string, so both sides of the comparison are stringified and
 * `depid` is never coerced on its way into the save: the same live row carries
 * `posgroupid: 47` and `depid: "100868"`, so the ERP's own model types the
 * department as text, and a number there could be refused by a strict binder.
 *
 * Nothing is fetched before a group is chosen — the whole list would be thrown
 * away by the filter anyway.
 *
 * `entryid > 0` edits (Postman): the row opens with its group and position.
 * The position list takes `search` only, so a saved position is labelled from
 * the row's own `positionname` (the server labels pulled rows too) or, failing
 * that, looked up in the whole list.
 */
export default function InterestsPage() {
  /** The row being edited, "new" for an addition, null when the form is closed. */
  const [editing, setEditing] = React.useState<InterestedJobRow | "new" | null>(null);
  const isAdding = editing !== null;
  const [isSaving, setIsSaving] = React.useState(false);
  const [group, setGroup] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [chosen, setChosen] = React.useState<DropdownOption | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const groups = useDropdown(() => reference.positionGroups(), []);

  const loadPositions = React.useCallback(
    async (query: DropdownQuery) => {
      const rows = await reference.positions(query);
      return rows.filter((row) => String(row.raw.posgroupid) === group);
    },
    [group],
  );

  /** A saved position's label: the one the row carries, else the list's. */
  const resolvePosition = React.useCallback(
    async (value: string): Promise<DropdownOption | null> => {
      const row = editing !== "new" ? editing : null;
      if (row && String(row.positionid ?? "") === value && row.positionname) {
        return { value, label: stripCode(row.positionname), raw: { key: value, text: row.positionname } };
      }
      const rows = await reference.positions({ search: "" });
      return rows.find((option) => option.value === value) ?? null;
    },
    [editing],
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

  /** Opens the form on `row` (an edit) or empty (an addition). */
  function open(row: InterestedJobRow | "new") {
    setEditing(row);
    setGroup(row === "new" ? "" : String(row.posgroupid ?? ""));
    setPosition(row === "new" || !row.positionid ? "" : String(row.positionid));
    setChosen(null);
    setError(null);
  }

  function close() {
    setEditing(null);
    setGroup("");
    setPosition("");
    setChosen(null);
    setError(null);
  }

  /** The department: the picked row's; an edit that kept its position keeps its own. */
  function depidOf(): string | null {
    if (!position) return null;
    if (chosen) return chosen.raw.depid ? String(chosen.raw.depid) : null;
    if (editing && editing !== "new" && String(editing.positionid ?? "") === position) {
      return editing.depid === null || editing.depid === undefined || editing.depid === ""
        ? null
        : String(editing.depid);
    }
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!group) {
      setError(INTEREST_GROUP_REQUIRED_MESSAGE);
      return;
    }
    const entryid = editing && editing !== "new" ? Number(editing.entryid) : 0;
    const next = { posgroupid: group, positionid: position };
    if (rows.some((row) => Number(row.entryid) !== entryid && sameInterest(row, next))) {
      setError(INTEREST_DUPLICATE_MESSAGE);
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await applications.saveInterest({
        entryid,
        posgroupid: Number(group),
        positionid: position ? Number(position) : null,
        depid: depidOf(),
      });
      toast.success(entryid ? "Хадгаллаа" : "Сонирхол бүртгэгдлээ");
      close();
      await reload();
    } catch (saveError) {
      setError(toApiError(saveError).message);
    } finally {
      setIsSaving(false);
    }
  }

  /** The row's group: its own label, else the group list's (a row labelled before the list loaded). */
  const groupOf = (row: InterestedJobRow) =>
    stripCode(row.posgroupname) ||
    (groups.options.find((option) => option.value === String(row.posgroupid ?? ""))?.label ?? "");

  async function remove(row: InterestedJobRow) {
    if (!window.confirm("Энэ бүртгэлийг устгах уу?")) return;
    try {
      await applications.deleteInterest(Number(row.entryid));
      // A save from a form still open on this row would bring it back.
      if (editing !== "new" && editing?.entryid === row.entryid) close();
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
            onClick={() => open("new")}
            className="h-9 rounded-full px-4"
          >
            <Plus className="size-4" />
            Нэмэх
          </Button>
        ) : null}
      </div>

      {isAdding ? (
        <form
          // A fresh form per row: the position box keeps no choice from the last one.
          key={editing === "new" ? "new" : String(editing.entryid)}
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
                onValueChange={(next) => {
                  setGroup(next);
                  setPosition("");
                  setChosen(null);
                  setError(null);
                }}
              >
                <option value="">{groups.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
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
              hint="Заавал биш - бүлгээр нь бүртгүүлж болно."
            >
              <AsyncCombobox
                id="position"
                value={position}
                disabled={!group}
                reloadKey={group}
                placeholder={group ? "Бичиж хайх" : "Эхлээд бүлгээ сонгоно уу"}
                emptyText="Энэ бүлэгт тохирох албан тушаал олдсонгүй."
                load={loadPositions}
                resolve={resolvePosition}
                onChange={(next, option) => {
                  setPosition(next);
                  setChosen(option);
                }}
              />
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
              onClick={close}
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
                  {stripCode(row.positionname) || groupOf(row) || "Ажлын байр"}
                </p>
                {row.positionname && groupOf(row) ? (
                  <p className="text-muted-foreground mt-0.5 truncate text-sm">{groupOf(row)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Засах"
                  onClick={() => open(row)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Устгах"
                  onClick={() => remove(row)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
