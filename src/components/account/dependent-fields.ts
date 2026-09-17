/**
 * Cascading selects, from one description of the edges.
 *
 * A dependent list is only meaningful under the parent it was read from:
 * `GetDistrictDropDown?divisionid=1` and `?divisionid=5` answer with disjoint
 * sets, so a district id chosen under one province is not a district of
 * another. Reloading the child's options on a parent change is therefore only
 * half the job — the child's own value has to go with them, or the previous
 * parent's id is what the education and computer-skill saves receive.
 *
 * Clearing runs down the whole chain, not just one level: changing Улс has to
 * clear Хот/аймаг *and* Сум/дүүрэг, because the district hangs off a province
 * that no longer belongs to the country above it.
 */

/** Parent field → the fields declaring it as a dependency. */
export type CascadeEdges = Record<string, string[]>;

export function cascadeEdges(
  fields: ReadonlyArray<{ name: string; deps?: string[] }>,
): CascadeEdges {
  const edges: CascadeEdges = {};
  for (const field of fields) {
    for (const parent of field.deps ?? []) {
      (edges[parent] ??= []).push(field.name);
    }
  }
  return edges;
}

/**
 * Every field downstream of `changed`, nearest first.
 *
 * `seen` guards a description that accidentally loops back on itself — a
 * misconfigured form should render, not hang the browser.
 */
export function dependentsOf(changed: string, edges: CascadeEdges): string[] {
  const seen = new Set<string>([changed]);
  const order: string[] = [];
  const queue = [...(edges[changed] ?? [])];

  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    order.push(name);
    queue.push(...(edges[name] ?? []));
  }

  return order;
}

/** `values` with everything downstream of `changed` emptied. */
export function clearDependents<T extends Record<string, unknown>>(
  values: T,
  changed: string,
  edges: CascadeEdges,
): T {
  const dependents = dependentsOf(changed, edges);
  if (dependents.length === 0) return values;

  const next = { ...values };
  for (const name of dependents) {
    next[name as keyof T] = "" as T[keyof T];
  }
  return next;
}
