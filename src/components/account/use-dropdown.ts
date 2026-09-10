"use client";

import * as React from "react";

import type { DropdownOption } from "@/lib/api";

/**
 * Loads one reference dropdown.
 *
 * `enabled` is what makes the dependent chains work: the district list only
 * loads once a province is chosen, matching how the backend expects to be
 * called (`GetDistrictDropDown?divisionid=…`).
 *
 * Loading is derived rather than tracked in its own flag — the options are
 * stale exactly while the key they were fetched for differs from the current
 * one, and deriving it keeps the effect free of synchronous state writes.
 */
export function useDropdown(
  loader: () => Promise<DropdownOption[]>,
  deps: React.DependencyList,
  enabled = true,
) {
  const key = enabled ? JSON.stringify(deps) : "";
  const [loaded, setLoaded] = React.useState<{ key: string; options: DropdownOption[] } | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;

    const request = enabled ? loader() : Promise.resolve<DropdownOption[]>([]);
    request
      .then((options) => {
        if (!cancelled) setLoaded({ key, options });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[dropdown] load failed", error);
        setLoaded({ key, options: [] });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return {
    options: loaded?.key === key ? loaded.options : [],
    isLoading: enabled && loaded?.key !== key,
  };
}

/** Wraps a fixed list in the dropdown option shape, for fields with no endpoint. */
export function staticOptions(items: Array<{ value: string; label: string }>) {
  return async () =>
    items.map((item) => ({
      value: item.value,
      label: item.label,
      raw: { key: item.value, text: item.label },
    }));
}
