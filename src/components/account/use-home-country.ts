"use client";

import * as React from "react";

import { reference } from "@/lib/api";

/**
 * The tenant's home country id as a `<select>` value, or `undefined` until
 * `getCountryID` answers (or if it fails — the picker then simply starts empty).
 *
 * The profile form seeds its country the same way; this is the read for the
 * section forms, which take their starting values as `defaults`. No id is
 * written down here: the collection disagrees with itself about which it is.
 */
export function useHomeCountry(): string | undefined {
  const [countryid, setCountryid] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;

    reference
      .defaultCountry()
      .then((home) => {
        if (!cancelled && home) setCountryid(String(home.countryid));
      })
      .catch((seedError) => {
        console.error("[account] default country failed", seedError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return countryid;
}
