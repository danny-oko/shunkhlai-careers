"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/components/auth/session-provider";
import { clearDependents } from "@/components/account/dependent-fields";
import { useDropdown } from "@/components/account/use-dropdown";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { profile as profileApi, reference, toApiError } from "@/lib/api";

/**
 * The applicant's core record — `SaveHrApplicant`.
 *
 * Country → province → district is a dependent chain on the backend, so
 * changing a parent clears its children rather than leaving an id that no
 * longer belongs to the selection above it. The edges are declared once, the
 * same way a `FieldDef` declares them, and `clearDependents` walks the chain.
 */

const CASCADE = {
  countryid: ["divisionid"],
  divisionid: ["districtid"],
};

const MARITAL_STATUSES = [
  { value: "S", label: "Гэрлээгүй" },
  { value: "M", label: "Гэрлэсэн" },
  { value: "D", label: "Салсан" },
  { value: "W", label: "Бэлэвсэн" },
];

type State = {
  lastname: string;
  firstname: string;
  regno: string;
  mobilephone: string;
  email2: string;
  addr2: string;
  maritalstatus: string;
  countryid: string;
  divisionid: string;
  districtid: string;
  contactname: string;
  relativeid: string;
  contactphone: string;
  contactname2: string;
  relativeid2: string;
  contactphone2: string;
};

function toState(source: Record<string, unknown> | null): State {
  const read = (key: string) => {
    const value = source?.[key];
    return value === null || value === undefined ? "" : String(value);
  };

  return {
    lastname: read("lastname"),
    firstname: read("firstname"),
    regno: read("regno"),
    mobilephone: read("mobilephone"),
    email2: read("email2"),
    addr2: read("addr2"),
    maritalstatus: read("maritalstatus"),
    countryid: read("countryid"),
    divisionid: read("divisionid"),
    districtid: read("districtid"),
    contactname: read("contactname"),
    relativeid: read("relativeid"),
    contactphone: read("contactphone"),
    contactname2: read("contactname2"),
    relativeid2: read("relativeid2"),
    contactphone2: read("contactphone2"),
  };
}

export function ProfileForm() {
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

  const countries = useDropdown(() => reference.countries(), []);
  const divisions = useDropdown(
    () => reference.divisions({ countryid: Number(values.countryid) }),
    [values.countryid],
    Boolean(values.countryid),
  );
  const districts = useDropdown(
    () => reference.districts({ divisionid: Number(values.divisionid) }),
    [values.divisionid],
    Boolean(values.divisionid),
  );
  const relatives = useDropdown(() => reference.relativeTypes(), []);

  // Хот/аймаг stays locked until a country is chosen, and for all but a
  // handful of applicants that country is the tenant's own. `getCountryID`
  // exists to say which it is — the collection's own note calls it the
  // pre-filter for the city/province dropdown — so nobody has to find it among
  // 84 rows, and no id is written down here. The collection disagrees with
  // itself about which id that is (`1` in two places, `496` in four), which is
  // the other half of why it has to be read rather than assumed.
  //
  // Keyed on the record that was loaded rather than on the field being empty:
  // an applicant who deliberately picks "- Сонгох -" would otherwise have the
  // choice undone on the next render.
  const hasSavedCountry = Boolean(snapshot?.countryid);
  React.useEffect(() => {
    if (hasSavedCountry) return;
    let cancelled = false;

    reference
      .defaultCountry()
      .then((home) => {
        if (cancelled || !home) return;
        setValues((current) =>
          current.countryid ? current : { ...current, countryid: String(home.countryid) },
        );
      })
      .catch((seedError) => {
        console.error("[profile] default country failed", seedError);
      });

    return () => {
      cancelled = true;
    };
  }, [hasSavedCountry, snapshot]);

  function set(name: keyof State, value: string) {
    setValues((current) => clearDependents({ ...current, [name]: value }, name, CASCADE));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!values.lastname.trim() || !values.firstname.trim()) {
      setError("Овог болон нэрээ оруулна уу.");
      return;
    }

    setIsSaving(true);
    try {
      await profileApi.saveProfile({
        lastname: values.lastname.trim(),
        firstname: values.firstname.trim(),
        regno: values.regno.trim().toUpperCase(),
        mobilephone: values.mobilephone.trim(),
        maritalstatus: values.maritalstatus || undefined,
        email2: values.email2.trim(),
        addr2: values.addr2.trim(),
        countryid: values.countryid ? Number(values.countryid) : null,
        divisionid: values.divisionid ? Number(values.divisionid) : null,
        districtid: values.districtid ? Number(values.districtid) : null,
        contactname: values.contactname.trim(),
        relativeid: values.relativeid ? Number(values.relativeid) : null,
        contactphone: values.contactphone.trim(),
        contactname2: values.contactname2.trim(),
        relativeid2: values.relativeid2 ? Number(values.relativeid2) : null,
        contactphone2: values.contactphone2.trim(),
      });

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
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Овог" htmlFor="lastname" required>
          <Input
            id="lastname"
            value={values.lastname}
            onChange={(event) => set("lastname", event.target.value)}
          />
        </Field>
        <Field label="Нэр" htmlFor="firstname" required>
          <Input
            id="firstname"
            value={values.firstname}
            onChange={(event) => set("firstname", event.target.value)}
          />
        </Field>
        <Field label="Регистрийн дугаар" htmlFor="regno">
          <Input
            id="regno"
            value={values.regno}
            readOnly
            className="bg-muted/50"
            aria-describedby="regno-hint"
          />
        </Field>
        <Field label="Утасны дугаар" htmlFor="mobilephone">
          <Input
            id="mobilephone"
            type="tel"
            value={values.mobilephone}
            onChange={(event) => set("mobilephone", event.target.value)}
          />
        </Field>
        <Field label="И-мэйл" htmlFor="email2">
          <Input
            id="email2"
            type="email"
            value={values.email2}
            onChange={(event) => set("email2", event.target.value)}
          />
        </Field>
        <Field label="Гэрлэлтийн байдал" htmlFor="maritalstatus">
          <Select
            id="maritalstatus"
            value={values.maritalstatus}
            onChange={(event) => set("maritalstatus", event.target.value)}
          >
            <option value="">- Сонгох -</option>
            {MARITAL_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Улс" htmlFor="countryid">
          <Select
            id="countryid"
            value={values.countryid}
            disabled={countries.isLoading}
            onChange={(event) => set("countryid", event.target.value)}
          >
            <option value="">{countries.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
            {countries.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Хот, аймаг" htmlFor="divisionid">
          <Select
            id="divisionid"
            value={values.divisionid}
            disabled={!values.countryid || divisions.isLoading}
            onChange={(event) => set("divisionid", event.target.value)}
          >
            <option value="">{divisions.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
            {divisions.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Сум, дүүрэг" htmlFor="districtid">
          <Select
            id="districtid"
            value={values.districtid}
            disabled={!values.divisionid || districts.isLoading}
            onChange={(event) => set("districtid", event.target.value)}
          >
            <option value="">{districts.isLoading ? "Ачаалж байна…" : "- Сонгох -"}</option>
            {districts.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Оршин суугаа хаяг" htmlFor="addr2">
        <Input
          id="addr2"
          value={values.addr2}
          placeholder="Дүүрэг, хороо, байр, тоот"
          onChange={(event) => set("addr2", event.target.value)}
        />
      </Field>

      <fieldset className="border-border/70 space-y-5 rounded-xl border p-5">
        <legend className="px-2 text-sm font-medium">Яаралтай үед холбоо барих</legend>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Нэр" htmlFor="contactname">
            <Input
              id="contactname"
              value={values.contactname}
              onChange={(event) => set("contactname", event.target.value)}
            />
          </Field>
          <Field label="Хэн болох" htmlFor="relativeid">
            <Select
              id="relativeid"
              value={values.relativeid}
              disabled={relatives.isLoading}
              onChange={(event) => set("relativeid", event.target.value)}
            >
              <option value="">- Сонгох -</option>
              {relatives.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Утас" htmlFor="contactphone">
            <Input
              id="contactphone"
              type="tel"
              value={values.contactphone}
              onChange={(event) => set("contactphone", event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Нэр (нэмэлт)" htmlFor="contactname2">
            <Input
              id="contactname2"
              value={values.contactname2}
              onChange={(event) => set("contactname2", event.target.value)}
            />
          </Field>
          <Field label="Хэн болох" htmlFor="relativeid2">
            <Select
              id="relativeid2"
              value={values.relativeid2}
              disabled={relatives.isLoading}
              onChange={(event) => set("relativeid2", event.target.value)}
            >
              <option value="">- Сонгох -</option>
              {relatives.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Утас (нэмэлт)" htmlFor="contactphone2">
            <Input
              id="contactphone2"
              type="tel"
              value={values.contactphone2}
              onChange={(event) => set("contactphone2", event.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <FormMessage message={error} />

      <Button type="submit" disabled={isSaving} className="h-10 rounded-full px-6">
        {isSaving ? <Loader2 className="animate-spin" /> : null}
        Хадгалах
      </Button>
    </form>
  );
}
