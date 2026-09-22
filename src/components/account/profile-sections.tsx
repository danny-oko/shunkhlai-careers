"use client";

import * as React from "react";

import {
  SelectField,
  TextField,
  type Choice,
  type Setter,
} from "@/components/account/profile-fields";
import {
  LICENCE_KEYS,
  maritalOptions,
  type LicenceKey,
  type State,
} from "@/components/account/profile-form-state";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicantProfile } from "@/lib/api/profile";

type Dropdown = { options: Choice[]; isLoading: boolean };

export const PHONE_HINT = "Энэ дугаар ERP системд нэвтрэх нууц үг тань болно.";

type SectionProps = { values: State; set: Setter };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="border-border/70 space-y-5 rounded-xl border p-5">
    <legend className="px-2 text-sm font-medium">{title}</legend>
    {children}
  </fieldset>
);

/**
 * регистр, овог, нэр, утас are what the ERP account is created with, so all
 * four are required (see `lib/applicant-identity.ts`). The регистр locks once
 * the account is linked to an ERP record: a different one would point the
 * sync at another person. The phone stays editable — it is the ERP password,
 * and the only way to repair a login the ERP refuses.
 */
export const PersonalSection = ({
  values,
  set,
  profile,
}: SectionProps & { profile: ApplicantProfile | null }) => (
  <Section title="Хувийн мэдээлэл">
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField name="lastname" label="Эцэг/эх-ийн нэр" values={values} set={set} required />
      <TextField name="firstname" label="Нэр" values={values} set={set} required />
      <TextField
        name="regno"
        label="Регистрийн дугаар"
        values={values}
        set={set}
        required
        readOnly={profile?.erplinked === true}
        hint={profile?.erplinked ? "ERP-ийн бүртгэлтэй холбогдсон тул өөрчлөгдөхгүй." : "Жишээ нь УБ99010101"}
      />
      <TextField name="mobilephone" label="Утас" values={values} set={set} required type="tel" hint={PHONE_HINT} />
      <TextField name="email2" label="Имэйл" values={values} set={set} required type="email" />
      <SelectField
        name="maritalstatus"
        label="Гэрлэлтийн байдал"
        values={values}
        set={set}
        options={maritalOptions(profile?.maritalOptions).map((m) => ({ value: m.key, label: m.text }))}
      />
    </div>
  </Section>
);

export const LicenceSection = ({
  values,
  toggle,
}: {
  values: State;
  toggle: (key: LicenceKey, checked: boolean) => void;
}) => (
  <Section title="Жолоонын ангилал">
    <div className="flex flex-wrap gap-6">
      {LICENCE_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values[key]}
            onChange={(event) => toggle(key, event.target.checked)}
          />
          {key.slice(2).toUpperCase()}
        </label>
      ))}
    </div>
  </Section>
);

export const AddressSection = ({
  values,
  set,
  countries,
  divisions,
  districts,
}: SectionProps & { countries: Dropdown; divisions: Dropdown; districts: Dropdown }) => (
  <Section title="Гэрийн хаяг">
    <div className="grid gap-5 sm:grid-cols-3">
      <SelectField
        name="countryid"
        label="Улс"
        values={values}
        set={set}
        required
        options={countries.options}
        isLoading={countries.isLoading}
      />
      <SelectField
        name="divisionid"
        label="Аймаг, хот"
        values={values}
        set={set}
        required
        options={divisions.options}
        isLoading={divisions.isLoading}
        disabled={!values.countryid}
      />
      <SelectField
        name="districtid"
        label="Сум, дүүрэг"
        values={values}
        set={set}
        required
        options={districts.options}
        isLoading={districts.isLoading}
        disabled={!values.divisionid}
      />
    </div>
    <TextField name="addr2" label="Дэлгэрэнгүй хаяг" values={values} set={set} required />
  </Section>
);

const ContactRow = ({
  suffix,
  required,
  relatives,
  values,
  set,
}: SectionProps & { suffix: "" | "2"; required: boolean; relatives: Dropdown }) => (
  <div className="grid gap-5 sm:grid-cols-3">
    <TextField
      name={`contactname${suffix}`}
      label="Овог, нэр"
      values={values}
      set={set}
      required={required}
    />
    <SelectField
      name={`relativeid${suffix}`}
      label="Таны хэн болох"
      values={values}
      set={set}
      required={required}
      options={relatives.options}
      isLoading={relatives.isLoading}
    />
    <TextField
      name={`contactphone${suffix}`}
      label="Утас"
      values={values}
      set={set}
      required={required}
      type="tel"
    />
  </div>
);

export const ContactSection = ({
  values,
  set,
  relatives,
}: SectionProps & { relatives: Dropdown }) => (
  <Section title="Яаралтай үед холбоо барих хүний мэдээлэл">
    <ContactRow suffix="" required relatives={relatives} values={values} set={set} />
    <ContactRow suffix="2" required={false} relatives={relatives} values={values} set={set} />
  </Section>
);

const QUESTIONS = [
  {
    name: "custom1",
    text: "Манай компанид одоогийн байдлаар таны хамаатан садан эсвэл танил, найз нөхөд ажилладаг уу? Хэрвээ тийм бол нэр болон албан тушаалыг бичнэ үү. /Хамаатан гэдэгт эцэг, эх, төрсөн ах дүү, эхнэр/нөхөр, хүүхэд, үеэл, авга болон нагац эгч/ах болон хадам эцэг/эхийг хамааруулан ойлгоно./",
  },
  {
    name: "custom2",
    text: "Таныг манай компанид ажилд орохыг санал болгосон БВМ-ийн ажилтан байгаа юу? Хэрвээ тийм бол нэр болон албан тушаалыг бичнэ үү.",
  },
] as const;

export const OtherSection = ({ values, set }: SectionProps) => (
  <Section title="Бусад">
    {QUESTIONS.map((question) => (
      <Field key={question.name} label={question.text} htmlFor={question.name}>
        <Textarea
          id={question.name}
          value={values[question.name]}
          onChange={(event) => set(question.name, event.target.value)}
        />
      </Field>
    ))}
  </Section>
);
