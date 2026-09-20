"use client";

import * as React from "react";

import { useHomeCountry } from "@/components/account/use-home-country";
import type { State } from "@/components/account/profile-form-state";

/**
 * Pre-fills Улс with the tenant's home country, but only for a record that
 * has none. A saved country (e.g. Япон) must never be overwritten by the
 * default — the seed also yields to anything already in the field.
 * `loaded` re-arms the seed when the form is reset from a fresh record.
 */
export const useSeedCountry = (
  hasSavedCountry: boolean,
  loaded: unknown,
  setValues: React.Dispatch<React.SetStateAction<State>>,
) => {
  const home = useHomeCountry();

  React.useEffect(() => {
    if (!home || hasSavedCountry) return;
    setValues((current) => (current.countryid ? current : { ...current, countryid: home }));
  }, [home, hasSavedCountry, loaded, setValues]);
};
