"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { clearDependents } from "@/components/account/dependent-fields";
import {
  AddressSection,
  ContactSection,
  LicenceSection,
  OtherSection,
  PersonalSection,
} from "@/components/account/profile-sections";
import {
  CASCADE,
  missingRequired,
  toInput,
  toState,
  type LicenceKey,
  type State,
} from "@/components/account/profile-form-state";
import { useDropdown } from "@/components/account/use-dropdown";
import { useSeedCountry } from "@/components/account/use-seed-country";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { profile as profileApi, reference, toApiError } from "@/lib/api";

/**
 * The applicant's core record — `SaveHrApplicant`, a full replace: the save
 * sends back every field it loaded (see `buildProfilePayload`).
 *
 * Country → province → district is a dependent chain on the backend, so
 * changing a parent clears its children rather than leaving an id that no
 * longer belongs to the selection above it.
 */

const useReferenceLists = (values: State) => ({
  countries: useDropdown(() => reference.countries(), []),
  divisions: useDropdown(
    () => reference.divisions({ countryid: Number(values.countryid) }),
    [values.countryid],
    Boolean(values.countryid),
  ),
  districts: useDropdown(
    () => reference.districts({ divisionid: Number(values.divisionid) }),
    [values.divisionid],
    Boolean(values.divisionid),
  ),
  relatives: useDropdown(() => reference.relativeTypes(), []),
});

const SubmitButton = ({ isSaving }: { isSaving: boolean }) => (
  <Button type="submit" disabled={isSaving} className="h-10 rounded-full px-6">
    {isSaving ? <Loader2 className="animate-spin" /> : null}
    Хадгалах
  </Button>
);

export const ProfileForm = () => {
  const { profile, refresh } = useSession();
  const [values, setValues] = React.useState<State>(() => toState(profile));
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // React's documented way to re-derive state when the source changes: adjust
  // during render rather than in an effect, so the form never paints a frame
  // with the previous applicant's values.
  const [snapshot, setSnapshot] = React.useState(profile);
  if (snapshot !== profile) {
    setSnapshot(profile);
    setValues(toState(profile));
  }

  const lists = useReferenceLists(values);
  useSeedCountry(Boolean(snapshot?.countryid), snapshot, setValues);

  const set = (name: string, value: string) =>
    setValues((current) => clearDependents({ ...current, [name]: value }, name, CASCADE));
  const toggle = (key: LicenceKey, checked: boolean) =>
    setValues((current) => ({ ...current, [key]: checked }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const problem = missingRequired(values);
    setError(problem);
    if (problem) return;

    setIsSaving(true);
    try {
      await profileApi.saveProfile(toInput(values), profile);
      // Mirror the update into our own DB (best-effort; doesn't block the UI).
      void fetch("/api/erp/sync", { method: "POST" });
      toast.success("Хувийн мэдээлэл хадгалагдлаа");
      await refresh();
    } catch (saveError) {
      setError(toApiError(saveError).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <PersonalSection values={values} set={set} profile={profile} />
      <LicenceSection values={values} toggle={toggle} />
      <AddressSection values={values} set={set} {...lists} />
      <ContactSection values={values} set={set} relatives={lists.relatives} />
      <OtherSection values={values} set={set} />

      <FormMessage message={error} />

      <SubmitButton isSaving={isSaving} />
    </form>
  );
};
